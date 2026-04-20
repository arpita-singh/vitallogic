

The user is asking how to test the just-shipped Marketplace Ingestion feature (Slice D). No code change needed — this is a guided UAT walkthrough. Keep it concrete, step-by-step, tied to the actual UI they have.

## How to test Marketplace Ingestion v1

### Prereqs
- Be signed in as an account with `expert` or `admin` role. If unsure, check `/account` — if you don't see "Expert workspace" links, your account isn't elevated yet and you'll get blocked at step 2.

### Test 1 — Run the import (happy path)
1. Navigate to `/expert/catalog` (or click the "Catalog" link in the expert nav).
2. Click **"Import from Healthy Habitat Market"**.
3. Wait ~5–15s. You should see a toast / status line like `Inserted N · Updated 0 · Skipped 0`.
4. The "Pending review" table populates with rows whose `category = uncategorised` and `source_authority = clinical` (placeholders).

**If it fails:** the partner's `products.json` may be blocked or rate-limited. The function returns a clean error message — read the toast.

### Test 2 — Curate one product
1. In the pending table, pick any row (e.g. the first Ashwagandha-style product).
2. Inline-edit: set a real `category` (e.g. "Adaptogen"), `source_authority` (`clinical` or `consecrated`), paste an `aust_l_number` if the product page lists one, tick `artg_verified`, optionally write a short `description`.
3. Click **Approve**. Row disappears from "pending" and moves to `live`.

### Test 3 — Verify live flow (expert side)
1. Open any consult and start/open a prescription draft.
2. In the product picker, search for the term you just curated (e.g. "ashwagandha").
3. The newly approved product should appear with the ARTG Listed badge if you ticked `artg_verified`.
4. Attach it. Confirm the snapshot timestamp gets stamped (Slice C behaviour still works).

### Test 4 — Verify patient sees it
1. Approve the prescription as expert.
2. Sign in as the patient (or open the result link).
3. On `/consult/{id}/result` the product card renders with: ARTG Listed badge, source-authority chip, "Buy at {vendor}" deep link, snapshot date.

### Test 5 — Re-sync (price/stock tracker)
1. Go back to `/expert/catalog` and click **Import** again.
2. Toast should now read `Inserted 0 · Updated N · Skipped M` — proves dedupe works and prices/stock refresh without clobbering your curation.

### Test 6 — Safety check (pending rows must NOT leak)
1. Leave a row as `pending_review` (don't approve it).
2. In a prescription draft's product picker, search for that product's name.
3. It should **not** appear. Only `live` rows are queryable for prescriptions.

### What I can do for you
I can drive this end-to-end in the preview browser if you'd like — just say the word. Otherwise the steps above are the manual UAT script.

