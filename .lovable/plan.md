

The user is sketching out a "Proxy Fulfillment" strategy — basically slice C from the earlier menu, refined. Three concrete asks:

1. **Deep linking** to exact products on partner sites (not just homepage)
2. **Legal disclaimer** UI component on every external link
3. **ARTG verification** — cross-check `aust_l_number` against TGA's public ARTG database, show "Verified in AU" badge

Let me check what we already have to be precise about the plan.

Existing relevant code:
- `certified_materia_medica` already has `aust_l_number` and `vendor_name` — but no external URL
- `ProductCard` (src/components/consult/product-card.tsx) currently has a "Purchase medication" button that just shows a toast
- No fulfillment table yet

The TGA ARTG database — there's no free public JSON API. The official source is the TGA's ARTG search at `tga.gov.au/resources/artg`, which returns HTML. Real-time scraping per product on every page load is wrong. The right pattern: experts manually mark ARTG-verified status when curating the catalog (since the AUST L number is itself the ARTG listing ID — its presence means TGA-listed). We can add a deep-link to TGA's search for the specific AUST L so users can verify themselves.

Scope this tightly to one shippable slice.

## Plan: Slice C — Proxy fulfillment with deep links, disclaimer, and ARTG verification

### 1. Schema (one migration)
Add to `certified_materia_medica`:
- `external_url text` — deep link to the exact product on the partner site (Healthy Habitat, Isha Life, etc.)
- `source_authority text` — enum-ish: `clinical` | `traditional` | `consecrated` (per the earlier "Full-Spectrum" idea)
- `artg_verified boolean default false` — expert-set flag confirming the AUST L is current in the ARTG register

No new table. The `vendor_name` + `external_url` + `aust_l_number` triple gives us everything needed for proxy fulfillment without owning inventory.

### 2. Update `ProductCard` (src/components/consult/product-card.tsx)
Replace the toast button with real behaviour:
- **If `external_url` exists**: render an anchor `<a href={external_url} target="_blank" rel="noopener noreferrer">Buy at {vendor_name}</a>` styled like the current button
- **If no URL**: keep the existing "Checkout coming soon" fallback
- **ARTG badge**: when `artg_verified` is true AND `aust_l_number` is set, show a small "Verified in AU · ARTG" badge near the AUST L number, linking to `https://tga.gov.au/resources/artg?keywords={aust_l_number}` so users can self-verify
- **Source authority chip**: tiny tag next to category showing `Clinical` / `Traditional` / `Consecrated`
- **Disclaimer**: a small line under the button — "External source · VitalLogic doesn't control third-party claims" — only when external_url is present

### 3. Update expert product picker (src/components/expert/product-picker.tsx)
The picker already pulls catalog rows. Surface `artg_verified` and `external_url` in the row preview so experts can see at a glance which products are verified vs unverified before attaching to a prescription.

### 4. Result page wiring (src/routes/consult_.$consultId.result.tsx)
The page already maps `attached_products` to `ProductCard`. We need to extend the `AttachedProduct` shape (and its source in the prescription's `attached_products` JSONB) to carry `external_url`, `artg_verified`, `source_authority`. Update both the type and the snapshot the expert saves when generating/editing a prescription.

### 5. Out of scope (deliberately)
- No live ARTG scraping. `artg_verified` is expert-curated; the user-facing badge links to TGA search so anyone can verify in one click.
- No actual e-commerce checkout — partners handle their own cart.
- No affiliate tracking / UTM params yet (can add later as a `?utm_source=vitallogic` query string append once we know the analytics need).
- No "Linker Module" ingestion pipeline — that's the future YouTube/RAG work, separate slice.

### Files I'll touch
- New migration: add 3 columns to `certified_materia_medica`
- `src/components/consult/product-card.tsx` — full rewrite of the action area
- `src/components/expert/product-picker.tsx` — surface verified/url in catalog rows + carry into AttachedProduct
- `src/routes/consult_.$consultId.result.tsx` — extend AttachedProduct type
- `src/components/expert/recommendation-editor.tsx` — same type extension so saved snapshots include the fields
- `supabase/functions/generate-prescription/index.ts` — include the 3 new fields when snapshotting safe products into `attached_products`

### Verification once shipped
1. Open any approved prescription → product cards show ARTG badge if verified, source-authority chip, and a "Buy at {vendor}" button that opens the partner page in a new tab
2. Cards without `external_url` still render cleanly with the original placeholder
3. Expert picker shows verified / non-verified state at attachment time
4. Disclaimer appears only on cards that link out

