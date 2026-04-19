

## Fix — `consults_anon_token_no_select_policy`

### Analysis
The scanner notes anonymous users can `INSERT` into `consults`/`consult_messages` but have no `SELECT` policy to read them back. The codebase already routes all anonymous reads through the `getConsult` server function (in `src/lib/consult-server.ts`), which uses `supabaseAdmin` (bypasses RLS) and verifies ownership via `anon_token_hash`. So the "missing read policy" is intentional — the safe path is server-mediated, not direct PostgREST.

The real risk the scanner is hinting at: the **INSERT policies are still open to anonymous clients**, even though our app exclusively writes through server functions (`startConsult`) using the service role. That leaves a redundant attack surface — an attacker could `POST /rest/v1/consults` directly, inserting arbitrary intake JSON with their own `anon_token_hash`. Same for `consult_messages` (it has no anon insert policy today, good — but the `consults` one is open).

### Fix — close the unused anonymous write path

Since 100% of anonymous writes go through `startConsult` (service role), we can safely **revoke the anonymous INSERT path on `consults`**. Authenticated owner inserts stay supported.

**Migration:**
```sql
-- Drop the permissive anon-or-owner insert policy
drop policy if exists "Consults: anyone can insert" on public.consults;

-- Replace with an authenticated-owner-only insert policy.
-- Anonymous consult creation now goes exclusively through the
-- startConsult server function (service role), which sets
-- anon_token_hash and bypasses RLS.
create policy "Consults: authenticated owner can insert"
on public.consults
for insert
to authenticated
with check (auth.uid() = user_id);
```

`consult_messages` already has no anon INSERT/SELECT policy, so anonymous direct writes/reads are already blocked there — nothing to change.

### Why not add anon SELECT policies instead?
Two reasons:
1. **No safe RLS-side token verification.** Postgres RLS can't read a custom header to compare against `anon_token_hash` without leaking timing/format details, and Supabase JWT claims for anon don't carry our token. Doing it in RLS would require either a SECURITY DEFINER RPC (same as our server fn) or storing the raw token in a JWT (worse).
2. **Server-mediated reads are already in place** (`getConsult`, `saveConsultContact`, `claimConsult`) and verify ownership properly with constant-time-ish hash comparison. Adding a parallel RLS path duplicates surface area for no UX gain.

### Mark the finding
After the migration lands, mark `consults_anon_token_no_select_policy` as fixed with the explanation: "Anonymous reads/writes are intentionally server-mediated via `getConsult`/`startConsult` server functions which verify `anon_token_hash`. Removed the redundant anonymous INSERT policy on `consults` so PostgREST no longer exposes a direct write path. `consult_messages` already has no anon policies."

### Side fix (preview is broken)
Runtime errors show `Missing Supabase server environment variables...` again, plus a downstream "Failed to fetch dynamically imported module". My previous `import.meta.env` fallback in `client.server.ts` apparently isn't catching all paths. I'll re-check the file and ensure:
- The fallback chain reads `process.env.X ?? import.meta.env.X` for both URL and service-role key.
- The throw happens **lazily inside `createSupabaseClient()`**, not at module top-level — so importing the module never crashes SSR; only actually using `supabaseAdmin` without env throws.
- Add a clearer error message listing which var was missing.

### Files changed
- New migration: `supabase/migrations/<ts>_lock_consults_insert.sql`
- `src/integrations/supabase/client.server.ts` — lazy init + better fallback
- Scanner: `mark_as_fixed` for `consults_anon_token_no_select_policy`

### Out of scope
- `user_purchases` owner UPDATE column scope (separate finding).
- Any future `consult_messages` anon flow — currently not used by the app.

