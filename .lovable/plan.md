

User wants "Prescribe" renamed to "Recommend" across the public-facing pillar content because they aren't legally prescribing — this is an important regulatory/claim-language correction (TGA-relevant). However, "prescribe/prescription" is also used as internal technical terminology throughout the codebase (table names, route names, edge functions, expert workflow). I need to scope this carefully.

## Scope decision

**User-facing language (CHANGE):** marketing/content pages where patients see the pillar described.

**Internal/technical (KEEP):** database tables (`prescriptions`, `prescription_audit`), routes (`/expert/$prescriptionId`), edge function names (`generate-prescription`), component names (`prescription-review-modal`), expert-side UI labels. Renaming these would be a massive churn for zero user-visible benefit and would risk breaking the audit trail. Experts internally still "review prescriptions" as a workflow concept — that's fine, only patients see the pillar wording.

Let me verify the user-facing surfaces by searching.
<lov-tool-use id="toolu_vrtx_01U8c7BayXCbnj2ZtuU6S8Mu" name="code--search_files" integration-id="code" data="{\"query\": \"Prescribe\", \"include_patterns\": \"src/routes/**/*.tsx,src/components/**/*.tsx,index.html\", \"exclude_dirs\": \"_authenticated\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DPnv7ZETqoRjauN87jEEuX" name="code--search_files" integration-id="code" data="{\"query\": \"prescri\", \"include_patterns\": \"src/routes/index.tsx,src/routes/journey.tsx,src/routes/philosophy.tsx,src/routes/pillars.tsx,src/routes/origins.tsx,src/routes/integrity.tsx,src/components/site-header.tsx,src/components/site-footer.tsx,src/routes/__root.tsx,index.html,README.md\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01MX1XirMDU4z1ZmtziH3Gvz" name="code--search_files" integration-id="code" data="{\"query\": \"Prescribe|prescribe|Prescription\", \"include_patterns\": \"src/routes/index.tsx,src/routes/journey.tsx,src/routes/philosophy.tsx,src/routes/pillars.tsx,src/routes/origins.tsx,src/routes/integrity.tsx,src/components/site-header.tsx,src/components/site-footer.tsx,src/routes/__root.tsx,src/routes/consult.tsx,index.html,README.md\"}">
</lov-tool-use>
Good — this is a patient-facing terminology change. The user wants "Prescribe" → "Recommend" on public-facing pillar copy because they're not actually prescribing. The internal `prescriptions` DB table, expert routes, and edge functions are technical names that don't show to patients — those should stay (changing them is a huge lift with no benefit). Let me confirm the scope of public-facing usage.
<lov-tool-use id="toolu_vrtx_0179TYvcFh3jDzJCq6ARWuzu" name="code--view" integration-id="code" data="{\"file_path\": \"src/routes/index.tsx\", \"lines\": \"25-95\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01E5w6JbHKdhFV7kg4FHzWas" name="code--view" integration-id="code" data="{\"file_path\": \"src/routes/integrity.tsx\", \"lines\": \"20-40\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012yuzRv1UVwt1e91MjyycP3" name="code--view" integration-id="code" data="{\"file_path\": \"src/routes/philosophy.tsx\", \"lines\": \"30-70\"}">
</lov-tool-use>
<lov-plan>

User says "I'm not prescribing anything" — this is a regulatory/positioning concern, not a database refactor. "Prescribe" implies medical authority they don't claim. Public-facing copy should say "Recommend"; internal DB tables (`prescriptions`, `prescription_audit`) and expert-tool labels can stay as engineering names since patients never see them, and renaming the schema is high-risk for zero patient benefit.

But there's nuance: a few patient-facing strings *also* use the word "prescription" (homepage CTA "Sign in to view your prescription"). Those should change too for consistency with the new positioning.

## Scope — patient-facing copy only

**Pillar rename: "Prescribe" → "Recommend"**
- `src/routes/index.tsx` line 31 — pillar card title + tagline
- `src/routes/pillars.tsx` lines 12, 17, 33 — meta description, og:description, Pillar 02 title
- `src/routes/index.tsx` line 84 — "Sign in to view your prescription" → "Sign in to view your recommendation"
- `src/routes/integrity.tsx` line 28 — "No prescription reaches you…" → "No recommendation reaches you…"
- `src/routes/philosophy.tsx` line 62 — "Tools over prescriptions" → "Tools over prescriptions" stays (it's a critique of conventional medicine, contextually correct) — leave as-is
- `src/routes/philosophy.tsx` line 37 — "prescribe a molecule" stays (also a critique of conventional medicine) — leave as-is

**Patient consult flow** — quick scan of `consult.tsx` and `consult_.$consultId.result.tsx` for any user-visible "prescription" / "prescribe" strings; rename to "recommendation" / "recommend" where they appear in copy (not variable names).

**Out of scope (intentionally untouched)**
- Database tables, columns, RLS policies (`prescriptions`, `prescription_audit`, `prescriptions.status`)
- Edge function names (`generate-prescription`)
- Expert-side routes & UI (`/expert/$prescriptionId`, queue cards) — internal practitioner tooling, "prescription" is the right professional term there
- TypeScript types, variable names, route param names
- README technical docs
- Changelog history

### Files touched
- `src/routes/index.tsx` (pillar card + sign-in line)
- `src/routes/pillars.tsx` (Pillar 02 title, body tag, meta tags)
- `src/routes/integrity.tsx` (guarantee #1 copy)
- `src/routes/consult.tsx` + `src/routes/consult_.$consultId.result.tsx` (any patient-visible copy — confirmed during edit)

### Verification
1. Homepage pillar grid shows "Recommend" as Pillar 02
2. `/pillars` page shows "Recommend" with updated body + meta tags (view source for og:title)
3. `/integrity` guarantee reads "No recommendation reaches you…"
4. Patient consult result page uses "recommendation" not "prescription" in headings/CTAs
5. Expert dashboard at `/expert` is unchanged (still says "Prescription review" — internal tool)
6. No broken imports / DB queries (table names untouched)

