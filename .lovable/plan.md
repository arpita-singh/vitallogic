

User has provided a UAT report for Slice C (Proxy Fulfillment) with 3 specific bugs to verify and fix. Let me explore the relevant code first to scope what's actually there vs what needs fixing.

Files to inspect:
- `src/components/consult/product-card.tsx` — likely renders the "Buy at {vendor}" button + disclaimer
- `src/routes/consult_.$consultId.result.tsx` — the page user is currently on, where the prescription renders
- `src/components/expert/product-picker.tsx` — Expert AUST L handling
- `supabase/functions/generate-prescription/index.ts` — snapshot logic (price, vendor, url)

Let me check these to confirm bug presence before proposing the plan.
<br>

## Plan: Slice C UAT fixes — 3 verified bugs + snapshot integrity

### Bugs to fix

**Bug 1 — External link security (`rel="noopener noreferrer"`)**
- Audit every `<a target="_blank">` rendering an `external_url` (product card on patient result page, expert product picker preview, catalog row "view on partner")
- Ensure all carry `rel="noopener noreferrer"` (catalog page already does; verify product card + any expert-side renderers)

**Bug 2 — AUST L number resilience for TGA search link**
- Wherever a TGA search URL is built from `aust_l_number`, normalise the value: strip the `AUST L ` prefix and all whitespace, keep digits only, then `encodeURIComponent` it
- Centralise in a small helper (e.g. `src/lib/tga.ts` → `buildArtgSearchUrl(austL: string)`) so product card, expert picker, and catalog all use the same logic
- Handles both `"AUST L 12345"` and `"12345"` inputs identically

**Bug 3 — Vendor name fallback on "Buy" button**
- In product card render: if `vendor_name` is empty/null but `external_url` exists, button label falls back to **"Buy at partner store"** instead of `"Buy at "` (broken string)
- Same fallback applied to the "External source · VitalLogic doesn't control third-party claims" disclaimer wording where it references the vendor

### Snapshot integrity (UAT recommendation #3, logic check)
- Inspect `generate-prescription` edge function to confirm `external_url` is included in the per-line JSONB snapshot alongside `price` and `vendor_name`
- If missing, add it so a patient's prescription stays functional even if the master catalog row is later edited

### Out of scope (acknowledged but no code change needed)
- Healthy Habitat product ID backup column — defer until that connector is built (currently returns "no public feed")
- Isha Life canonical URL check — the importer already stores Shopify's canonical `au.ishalife.com/products/{handle}` from the feed; verify in the function and only act if it's storing redirect URLs

### Files likely touched
- `src/components/consult/product-card.tsx` (rel attr, vendor fallback, TGA helper)
- `src/components/expert/product-picker.tsx` (TGA helper, rel attr if applicable)
- `src/lib/tga.ts` (new — AUST L normaliser + URL builder)
- `supabase/functions/generate-prescription/index.ts` (snapshot includes external_url, if missing)

### Verification once shipped
1. Inspect product card on `/consult/:id/result` — "Buy at" button has `rel="noopener noreferrer"`, falls back to "Buy at partner store" when vendor blank
2. Click "Verify on TGA" with both `"AUST L 123456"` and `"123456"` inputs — both resolve to the same valid TGA search URL
3. Generate a fresh prescription, inspect `attached_products[0]` JSONB — confirms `external_url`, `price`, `vendor_name` all snapshotted
4. No regression on `/expert/catalog` external links

