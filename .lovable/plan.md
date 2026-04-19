

The scanner's title is about `has_role`, but the actual exploitable risk it describes is the **`Consults: claim anonymous` UPDATE policy**. That policy currently lets any authenticated user claim any unclaimed anonymous consult just by knowing its UUID — no proof of `anon_token_hash` ownership is required at the database level. The same hole exists in the `claimConsult` server function's fallback branch (separate finding `claim_consult_idor`), which uses the service role to claim with no token check.

The previous `has_role` hardening pass already neutralized the parameter-ignore concern. So the right fix here is to close the consult-hijack path at both layers: RLS and the server function.

### Fix plan

**1. Database migration — remove the broad anonymous-claim path**

Drop the existing wide-open RLS policy:
- `Consults: claim anonymous` (UPDATE, USING `user_id IS NULL`, CHECK `auth.uid() = user_id`)

We will NOT replace it with a token-checking RLS policy, because the `anon_token_hash` is a server-side secret and shouldn't be sent from the browser to PostgREST in the clear. Instead, all claims will go through the `claimConsult` server function (service role + token verification). The browser no longer needs RLS UPDATE access to anonymous consults at all.

Owners can still update their own consults via the existing `Consults: owner can update own` policy (after claim). Experts/admins keep their existing policies.

**2. Server function hardening — `src/lib/consult-server.ts`**

Tighten `claimConsult`:
- Require a valid `anonToken` whose SHA-256 matches the row's `anon_token_hash`. Without it, refuse.
- Remove the unconditional fallback that claims any unowned consult by id alone.
- Keep one narrow recovery path: if `anonToken` is missing, allow the claim **only** when the consult's `intake.contactEmail` matches the verified user's email (from the JWT). This preserves the "I lost my browser token but signed up with the same email" recovery flow without enabling UUID-based hijack.

Update `src/lib/claim-consult.ts` consumers (already pass token) — no client API change required, just stricter server-side behavior.

**3. Quick runtime-error fix (unrelated but blocking)**

`getConsult`/server functions are throwing "Missing Supabase server environment variables". The proxy in `client.server.ts` reads `process.env` lazily — this should work in the Worker, so the real cause is likely that the env isn't propagated in the current SSR runtime. I'll switch the lookup to also check `import.meta.env.SUPABASE_URL` / service key as a fallback before throwing, and verify after the migration runs. (If env truly isn't set, the user needs to confirm their Cloud secrets — they already exist per `<secrets>`, so this should resolve itself once we redeploy.)

### Files to change
- New migration: `supabase/migrations/<ts>_lock_consult_claim.sql` — drop `Consults: claim anonymous`
- `src/lib/consult-server.ts` — require token or verified-email match in `claimConsult`

### What this fixes
- Closes `has_role_ignores_parameter` (the actual exploit path described — anonymous-consult hijack).
- Closes the related `claim_consult_idor` finding in the same pass.
- Preserves the legitimate flows: token-bearing browser claim, and email-verified recovery after sign-up.

### Out of scope (separate findings, will tackle next if you want)
- `prescriptions_realtime_no_rls_channel_auth` (Realtime channel auth)
- `consult_messages_anon_no_select` (anonymous message read/write via server functions)
- `user_purchases_owner_unrestricted_update` (lock down columns or move to server fn)

