

The user is sharing rich content about Dr. Om Prakash 'Anand' from anandyoga.com — Panchang Yoga, Pancha Mahabhuta therapy, specialized protocols (color blindness, Parkinson's, Polio), authored bibliography, alternative modalities (mud therapy, magnet therapy, acupressure).

This is a **knowledge ingestion / RAG seed** request, not a UI feature. They want this expert's wisdom available to the consult AI as grounded reference material — the "Linker Module" they keep referencing.

Let me think about scope. There are three things they're really asking for:

1. **Ingest** anandyoga.com content as structured reference material the AI can cite
2. **Extend the schema** to handle non-herbal modalities (yoga limbs, elements therapy, mud, magnet, acupressure) and lifestyle protocols (daily schedules)
3. **Authority/citation** — track that recommendations are sourced from Dr. Anand's tradition

I should NOT build the full RAG pipeline today — that's weeks of work (vector store, embeddings, retrieval ranking, citation UI). Instead: a focused first slice that lands the foundation and proves the pattern with this one source. Future sources slot into the same shape.

Two real options on ingestion:
- **(A) One-time scrape + curated insert** — use Firecrawl or fetch_website during plan execution, then INSERT structured rows into a new `wisdom_sources` + `wisdom_protocols` pair of tables. Manual quality > automated noise for the first source.
- **(B) Live scrape on demand** — build a server function that hits Firecrawl per consult. Slow, costly, fragile.

(A) is right. Curated > live for high-trust health content.

Schema-wise, instead of jamming this into `certified_materia_medica` (which is product-shaped: stock_status, price, AUST L, vendor — none of that fits a yoga protocol), add two purpose-built tables.

I should also clarify one thing before committing: do they want the AI to *automatically* recommend Dr. Anand's protocols inside generated prescriptions, or do they want a separate "Wisdom Library" surface that experts and patients can browse and that experts can manually attach (like the product picker)? Big design fork. I'll ask.

Actually let me check the consult-chat function quickly to see how grounded context is currently passed to the AI.

Looking at the codebase summary — `supabase/functions/consult-chat/index.ts` and `generate-prescription/index.ts` exist. They likely pull from `certified_materia_medica` for product grounding. The same pattern extends to a new `wisdom_protocols` table.

Let me also consider whether to use Firecrawl. The user mentioned the site is bilingual (Hindi/English), small, and the structure is loose. `code--fetch_website` (already available, no connector needed) is enough for a first pass — handful of pages, manual curation, structured INSERTs. Firecrawl is overkill for one source.

Asking one tight clarifying question, then planning.

## Plan: Wisdom ingestion v1 — Anandyoga as the seed source

### Decision needed first
**Q:** When the AI generates a prescription, should Dr. Anand's protocols (yoga limbs, mud therapy, daily schedules) be **auto-suggested alongside herbal products** in the same draft, OR live in a **separate "Lifestyle & Practice" picker** that the expert chooses to attach? My recommendation is the latter — keeps the herbal/clinical pipeline clean, gives experts deliberate control over modality mixing, matches the existing product-picker UX. I'll proceed with **separate picker** unless you say otherwise.

### Schema (one migration, two new tables)

**`wisdom_sources`** — provenance for everything ingested
- `id uuid pk`
- `name text` ("Dr. Om Prakash 'Anand' — Anand Yoga")
- `tradition text` ("Panchang Yoga / Naturopathy")
- `authority_url text` ("https://anandyoga.com")
- `bibliography jsonb` — array of `{title, year}` for the ~50 books
- `practitioner_count int`, `notes text`
- `created_at`, `updated_at`

**`wisdom_protocols`** — atomic, attachable units of practice
- `id uuid pk`, `source_id uuid → wisdom_sources`
- `name text` (e.g. "Mitti Chikitsa — abdominal mud pack")
- `name_native text` (Devanagari original)
- `modality text` — enum-ish: `yoga` | `pranayama` | `element_therapy` | `mud_therapy` | `magnet_therapy` | `acupressure` | `shatkarma` | `daily_schedule`
- `element text nullable` — `space` | `air` | `fire` | `water` | `earth` (for Pancha Mahabhuta mappings)
- `indications text[]` — symptom/condition tags ("digestion", "anxiety", "cervical spondylitis", "color vision")
- `contraindications text[]` — safety guardrails (pregnancy, hypertension, etc.)
- `protocol_steps jsonb` — ordered steps, optional duration/time-of-day
- `expected_outcome text`, `evidence_level text` (`empirical` | `traditional` | `clinical`)
- `artg_relevant boolean default false` (most won't be — not a product)
- `created_at`, `updated_at`

RLS mirrors `certified_materia_medica`: public read, expert/admin write.

### Ingestion (one-shot, in default mode)
- Use `code--fetch_website` to pull Anand Yoga's key sub-pages (Panchang Yog, Naturecure, Mitti Chikitsa, Daily Programme, About). No Firecrawl needed for one source.
- Use `lovable_ai.py` (the AI-gateway skill) with a structured-output schema to extract `wisdom_protocols` rows from the markdown — modality, element, indications, steps. AI does the translation/structuring; I review and INSERT.
- INSERT one `wisdom_sources` row + ~10–15 curated `wisdom_protocols` rows. Quality over volume.

### Expert UI — minimal v1
New component `src/components/expert/wisdom-picker.tsx` (mirrors `product-picker.tsx`):
- Search by indication, modality, element
- Shows source/tradition chip + evidence-level badge
- Attaches snapshot into prescription's `attached_protocols` JSONB (new field on `prescriptions` — alongside `attached_products`, with the same `snapshot_at` immutability pattern)

### Patient UI — minimal v1
On `consult_.$consultId.result.tsx`, render attached protocols below the medications block as `<ProtocolCard />` (new component):
- Modality + element chips
- Step-by-step protocol
- "Tradition: Panchang Yoga · Anand Yoga" attribution line linking to `authority_url`
- Same `snapshot_at` "Catalog snapshot · {date}" timestamp for audit consistency

### Out of scope (deliberately, for follow-up slices)
- Vector embeddings / RAG retrieval — protocols are tag-searchable in v1; embeddings come when we have 3+ sources
- Auto-attach by AI in `generate-prescription` — manual expert curation only in v1 (pending your answer above)
- Multi-source ingestion pipeline / scheduled scraping
- "Find a Practitioner" network feature
- Bibliography → citation graph

### Files I'll touch (in default mode after approval)
- New migration: `wisdom_sources`, `wisdom_protocols`, RLS, plus `attached_protocols jsonb` column on `prescriptions`
- Run fetch + AI structuring + INSERT for the seed data
- `src/components/expert/wisdom-picker.tsx` (new)
- `src/components/consult/protocol-card.tsx` (new)
- `src/components/expert/recommendation-editor.tsx` — wire in wisdom picker + attached_protocols
- `src/routes/consult_.$consultId.result.tsx` — render attached_protocols
- `src/integrations/supabase/types.ts` regenerates automatically

### Verification
1. Migration runs; two new tables visible with RLS
2. Seed ingestion produces 10+ Anand Yoga protocols, source row populated
3. Expert opens prescription review → "Attach practice/protocol" alongside "Attach product" → searches "digestion" → sees Mitti Chikitsa from Anand Yoga with evidence chip → attaches
4. Patient on result page sees the medication cards AND a new "Practices & Protocols" section with the snapshot timestamp + Anand Yoga attribution

