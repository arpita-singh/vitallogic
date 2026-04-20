

The user is sketching the "Fulfillment Linker" — turn AI recommendations into live, in-stock buy buttons by syncing a partner marketplace's catalog into our `certified_materia_medica` table. They mention healthyhabitatmarket.com specifically.

Let me check what's actually achievable here. The site is a Shopify-style storefront (based on the `/collections`, `/products` URL pattern they cite). Two ingestion paths:

1. **Shopify public JSON endpoint** — every Shopify store exposes `/products.json` and `/collections/{handle}/products.json` publicly, returning structured product data (title, handle, price, variants, images, vendor, in-stock status). No scraping, no API key, no Firecrawl needed.
2. **Firecrawl scrape** — fallback if the site isn't Shopify or blocks the JSON endpoint.

Let me also check what we already have in the catalog so I scope this right.

I already know `certified_materia_medica` has: product_name, category, vendor_name, external_url, aust_l_number, artg_verified, source_authority, price, stock_status, description. So the schema already fits. What's missing is just the **ingestion pipeline** + a way to **refresh** stock/price periodically.

Three real questions worth being explicit about before building:

- **Auto vs review:** should imported products land directly in the live catalog (instant Buy Now), or in a staging area for an expert to approve/categorise first? Compliance-wise, the latter is much safer — the expert assigns category, source_authority, ARTG status, and writes the description before patients see it.
- **Refresh cadence:** one-time import vs scheduled re-sync. v1 = on-demand button.
- **AUST L matching:** Healthy Habitat product titles won't include AUST L numbers. Expert has to add those manually during review. Don't pretend we can auto-verify ARTG.

Recommend: **expert-reviewed import**, on-demand for v1. Avoids dumping uncurated SKUs into a clinical recommendation system.

Scope this tight: one server function that fetches the partner's `products.json`, dedupes against existing `external_url`s, inserts as **draft rows** (new column `import_status`), plus a small expert UI to review/approve them.

## Plan: Slice D — Marketplace ingestion v1 (Healthy Habitat Market)

### 1. Schema (one tiny migration)
Add to `certified_materia_medica`:
- `import_status text default 'live'` — `live` | `pending_review` | `rejected`
- `import_source text nullable` — e.g. `healthyhabitatmarket.com`
- `import_external_id text nullable` — Shopify product ID for dedupe on re-sync
- Unique index on `(import_source, import_external_id)` to prevent duplicates

Update the patient-facing query (`product-card.tsx` flow / wherever the catalog is read for prescriptions) to filter `import_status = 'live'` so pending rows never reach patients. Existing rows default to `live` — no breakage.

### 2. Ingestion server function
New `src/utils/marketplace-import.functions.ts` exposing `importMarketplaceProducts`:
- Input: `{ source: 'healthy_habitat', collection?: string, limit?: number }`
- Fetches `https://healthyhabitatmarket.com/products.json?limit=250` (Shopify public endpoint — no auth)
- For each product: map `title → product_name`, `vendor → vendor_name`, `variants[0].price → price`, `variants[0].available → stock_status`, build `external_url` from handle
- Insert as `import_status = 'pending_review'` with `source_authority = 'clinical'` default and `category = 'uncategorised'` (expert sets these on review)
- Skip products already present (matched on `import_source` + `import_external_id`) but UPDATE their price + stock_status (the "Price & Stock Tracker" the user asked for)
- Server function only — uses `requireSupabaseAuth` middleware + checks the user has `expert` or `admin` role; rejects otherwise
- Returns `{ inserted: n, updated: n, skipped: n }`

If the JSON endpoint fails or isn't Shopify, fall back to telling the expert "Use Firecrawl connector for this source" — don't silently break.

### 3. Expert review UI
New route `src/routes/_authenticated/_expert/expert.catalog.tsx`:
- "Import from Healthy Habitat Market" button → calls the server function
- Table of `import_status = 'pending_review'` rows with inline editors for: category, source_authority, AUST L number, artg_verified, description
- Per-row Approve (sets `import_status = 'live'`) or Reject (sets `import_status = 'rejected'`)
- Live count: "{n} products awaiting review · last sync {date}"

This is the human-in-the-loop checkpoint that keeps unverified SKUs out of patient prescriptions.

### 4. Patient-facing UX (no new component)
Once approved, products flow through the existing `product-picker.tsx` → `ProductCard` pipeline already shipped in Slice C. No changes needed — they get the deep link, snapshot timestamp, and ARTG Listed badge automatically.

### 5. Out of scope (deliberately)
- **Scheduled sync / cron** — v1 is manual button. A nightly refresh is a 5-line follow-up using a server route + an external cron pinger (e.g. cron-job.org), but defer until we know which partners we actually want to sync.
- **Multi-source** — wired for one source. Adding Isha Life or another Shopify store is just a new entry in a `MARKETPLACE_SOURCES` config map.
- **Non-Shopify scraping** — would need the Firecrawl connector. Defer.
- **Closed-loop "Buy Now → order tracking"** — partners own the cart. We just deep-link.
- **Auto-AUST L verification** — TGA has no free product-lookup API; expert sets this manually during review.

### Files I'll touch
- New migration: 3 columns + unique index on `certified_materia_medica`
- New `src/utils/marketplace-import.functions.ts` (server function)
- New `src/routes/_authenticated/_expert/expert.catalog.tsx` (review UI)
- Edit any place the catalog is queried for patients (`product-picker.tsx`, possibly `generate-prescription` edge function) to filter `import_status = 'live'`

### Verification once shipped
1. As expert, navigate to `/expert/catalog`, click "Import from Healthy Habitat Market" → see N products inserted with `pending_review` status
2. Edit category + source_authority + AUST L on one row, click Approve → row becomes `live`
3. Open the `product-picker` on a prescription draft → the newly approved product appears in search
4. Re-run the import → existing products' prices/stock update; counts show "0 inserted, N updated"
5. As patient, view a prescription with that product → existing Slice C flow renders the ARTG badge and deep link correctly

