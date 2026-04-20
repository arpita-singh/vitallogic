

The user wants to wire Isha Life AU as a second marketplace source alongside Healthy Habitat Market. They explicitly tag it as `source_authority: consecrated/traditional` which is a perfect distinction from the clinical/Healthy Habitat lane.

Slice D already shipped a single-source pipeline hardcoded to `healthyhabitatmarket.com`. The right move is a small refactor: extract a `MARKETPLACE_SOURCES` config map, parameterise the import function, and add a second button in the catalog UI. Schema is already source-agnostic (`import_source` is a free text column). Zero migration needed.

Quick sanity check on Isha Life AU — `ishalife.com.au` (or `.com`?) — needs to be a Shopify store for the public `/products.json` endpoint trick to work. I should verify in default mode by curling `https://ishalife.com.au/products.json` before committing. If it's not Shopify or blocks the endpoint, fall back to telling the expert "needs Firecrawl" — same graceful failure path Slice D already has.

One real decision: do imported Isha Life products default to `source_authority = 'consecrated'` (matching the user's framing) while Healthy Habitat defaults to `clinical`? Yes — that's the whole point of two sources. Bake the default into the source config map, not the function.

Keeping scope tight. No new components, no new routes, no schema changes.

## Plan: Slice E — Add Isha Life AU as second marketplace source

### 1. Refactor: extract source config (no new files needed)
In `src/utils/marketplace-import.functions.ts`, replace the hardcoded Healthy Habitat URL with a config map:

```ts
const MARKETPLACE_SOURCES = {
  healthy_habitat: {
    label: "Healthy Habitat Market",
    domain: "healthyhabitatmarket.com",
    productsUrl: "https://healthyhabitatmarket.com/products.json",
    defaultSourceAuthority: "clinical",
  },
  isha_life: {
    label: "Isha Life AU",
    domain: "ishalife.com.au",
    productsUrl: "https://ishalife.com.au/products.json",
    defaultSourceAuthority: "consecrated",
  },
} as const;
```

The existing `importMarketplaceProducts` server function already accepts `source` as input — just looks it up in the map instead of branching. The default `source_authority` written into pending rows now comes from the source config, so Isha Life products land tagged `consecrated` and Healthy Habitat products stay `clinical` — expert can still override during review.

### 2. Verify Isha Life is Shopify (in default mode, before coding)
Run `curl -sI https://ishalife.com.au/products.json` and a small `curl -s ...products.json?limit=1` to confirm:
- 200 OK
- Returns `{"products":[...]}` shape
- No CAPTCHA / Cloudflare block

If it fails, surface that to the user immediately and offer the Firecrawl connector path as the v1.1 alternative — don't ship a broken button.

### 3. Catalog UI: second import button
In `src/routes/_authenticated/_expert/expert.catalog.tsx`, render two buttons side by side instead of one:
- "Import from Healthy Habitat Market"
- "Import from Isha Life AU"

Each calls the same server function with the corresponding `source` key. Toast messages show the source label so it's obvious which one ran.

Tiny addition: filter chip above the pending table to filter by `import_source` (`all` / `healthy_habitat` / `isha_life`), since experts will likely curate one source at a time.

### 4. Out of scope
- Scheduled refresh (still manual button)
- Non-Shopify scraping fallback for either source (defer to Firecrawl slice)
- Separate visual treatment for `consecrated` vs `clinical` rows in patient UI — Slice C already renders the source-authority chip, so it just works automatically

### Files I'll touch
- `src/utils/marketplace-import.functions.ts` — extract `MARKETPLACE_SOURCES` map, parameterise lookup, default authority comes from config
- `src/routes/_authenticated/_expert/expert.catalog.tsx` — second button + source filter chip

### Verification once shipped
1. `/expert/catalog` shows two import buttons
2. Click "Import from Isha Life AU" → toast `Isha Life AU: N inserted · 0 updated · 0 skipped`
3. Pending rows show `source_authority = consecrated` by default
4. Filter chip narrows the pending table to one source
5. Approve a row → flows through existing Slice C product picker → patient sees consecrated badge on the result page
6. Re-running either import only updates rows from that source (dedupe per `(import_source, import_external_id)` already in place)

