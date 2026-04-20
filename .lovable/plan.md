
Root cause is now clear from the network trace, not the partner feeds:

- Clicking either import button sends `POST /_serverFn/...`
- That request returns `401 Unauthorized: No authorization header provided`
- `importMarketplaceProducts` is protected by `requireSupabaseAuth`, which only accepts a Bearer token from the request headers
- The catalog page calls the server function directly from the client, so the auth header is not being forwarded
- That thrown `Response` bubbles into the client as `Error: [object Response]`, which is why you get both the failed toast and the runtime error/blank-screen behavior

So the bug is the auth transport for the import action, not the catalog route itself.

## Plan

### 1. Replace the current import transport
Stop calling the TanStack server function directly from `/expert/catalog` for this action.

Instead, move marketplace ingestion behind a backend function invoked through the app’s authenticated backend client pattern, because that path already forwards the signed-in user’s JWT correctly.

Why this approach:
- it matches the existing `consult-access` pattern already used in the app
- it avoids editing the generated auth middleware
- it removes the `401 no authorization header` failure at the source

### 2. Move import logic into a dedicated backend function
Create a new backend function for marketplace import that:
- verifies the caller from the incoming JWT
- checks `user_roles` and only allows `expert` or `admin`
- keeps the current source-specific behavior:
  - `isha_life`: fetch Shopify `products.json` with the User-Agent header, parse, insert/update staged rows
  - `healthy_habitat`: return a clear “no public feed / manual connector required” result
- always returns structured JSON (`ok`, `error`, counts, source), never a thrown raw `Response` for expected failures

### 3. Update the catalog page to use the new backend client helper
Change the import button handler in `/expert/catalog` so it:
- calls a small client helper via the backend client
- shows the exact returned message in the toast
- preserves the loading spinner / disabled state
- refreshes the pending-review list after a successful import
- no longer falls into the runtime-error path on expected auth or partner failures

### 4. Keep the UX resilient
Tighten error handling so expected failures stay as normal UI feedback:
- auth failure → friendly toast, no crash
- Healthy Habitat unavailable feed → informative toast
- partner non-JSON / blocked feed → informative toast
- successful import → inserted / updated / unchanged counts

## Files likely touched
- `src/routes/_authenticated/_expert/expert_.catalog.tsx`
- `src/utils/marketplace-import.functions.ts` or a replacement client helper file
- `supabase/functions/marketplace-import/index.ts` (new)

## Verification after implementation
1. Clicking either import button no longer calls `/_serverFn/...` with a missing auth header
2. No `Error: [object Response]` runtime error appears
3. Isha import either stages products successfully or returns a clear partner-feed error
4. Healthy Habitat returns the intended “manual connector required” message
5. `/expert/catalog` stays stable and refreshes pending-review rows after success
