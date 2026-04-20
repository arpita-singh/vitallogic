

The user is sharing architectural ideas for a major new subsystem — the "Linker Module" — covering RAG schemas, YouTube transcript ingestion ("Cure Hunter"), and fulfillment integrations (Healthy Habitat Market, Isha Life). This is a big new direction, not a continuation of the stale-session bug fix from the previous turn.

Before planning, I need to understand:
1. The user just received a session-fix in the previous turn but never confirmed it works. That fix is unverified.
2. The user is asking implicit questions ("Would you like…", "Is this market…", "Would you like me to help…") rather than giving a clear build directive.
3. This is a massive scope expansion: vector DB, embeddings, Python scraping, YouTube API, fulfillment APIs, new tables, new edge functions.

I should NOT silently plan a 3-week ingestion pipeline. I should clarify what they actually want next.

## Plan

### Step 1 — confirm the previous fix landed
Quickly verify the stale-session fix from the prior turn worked end-to-end on `/consult/.../result` before opening a new workstream. Otherwise we pile new architecture on top of an unverified bug.

### Step 2 — narrow the new scope with the user
The "Linker Module" as written is 4–6 weeks of work. We need to pick a wedge. I'll ask which slice they want first.

### Step 3 — once a slice is chosen, plan that slice properly
Each option below maps to a concrete, shippable increment:

- **A. Schema-only foundation** — add `materia_medica_normalized` table matching the proposed JSON schema (identity, energetics, clinical_logic, safety_guardrails, vector_payload). Enable `pgvector`, add an `embedding vector(1536)` column, RLS for public read + expert write. No ingestion yet. Lets the rest of the app start consuming structured data.
- **B. Safety guardrails wired into the existing recommender** — add a `safety_guardrails` JSONB column to `certified_materia_medica`, update `generate-prescription` edge function to filter recommendations against the user's intake flags (pregnancy, hyperthyroid, autoimmune, current meds). Smallest change, highest user-safety payoff. No vectors, no scraping.
- **C. Fulfillment links** — add a `fulfillment_sources` table mapping internal product IDs → external store URLs (Healthy Habitat, Isha Life). Surface "Buy at trusted source" buttons on the prescription result page. Pure CRUD, no scraping.
- **D. RAG retrieval, ingestion deferred** — build the edge function that takes an intake, embeds it, queries `pgvector` for nearest matches in `materia_medica_normalized`, and returns top-K with safety filtering applied. Seed the table manually with 10–20 herbs to start. No YouTube, no scraping pipeline.

### Step 4 — explicit rejections (out of scope until later)
- The Python "Cure Hunter" YouTube pipeline is a separate service that doesn't belong inside this Worker-runtime app. Documented but not built.
- Scraping `anandyoga.com` or any third-party catalog without a license is a legal/IP concern — flag rather than implement.
- "Trust score" UI badges depend on having ingestion sources first; deferred.

### Why ask instead of just building
- Each slice (A/B/C/D) is a real 1–3 day build with its own migration and edge function. Building all four blind would mean 5+ migrations, 3 new edge functions, a new table family, and pgvector setup — all without the user confirming that's the priority over (e.g.) just finishing the prescription flow that was broken yesterday.
- The user's last verifiable request ("verify claim flow") is still unconfirmed.

### What I'll do this turn
1. Recommend confirming the session fix first.
2. Ask which slice (A/B/C/D, or something else) to build next.
3. Hold off on schema/migration writes until they pick.

