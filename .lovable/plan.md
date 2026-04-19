
Do I know what the issue is? Yes.

The prescription data is still there. The current failure is a runtime architecture bug, not deleted data.

## What happened
Two separate regressions are showing up on the result page:

1. `getConsult` now runs through `src/lib/consult-server.ts`, which uses `supabaseAdmin` from `src/integrations/supabase/client.server.ts`.
2. That admin client requires `SUPABASE_SERVICE_ROLE_KEY`, but the Worker server runtime serving TanStack server functions does not have that secret, so `getConsult` throws immediately.
3. After that failure, the page falls into the recovery path and repeatedly calls `claimConsult`, but that server function uses `requireSupabaseAuth`, and the browser is not sending an Authorization header to the server function request, so it returns `401 Unauthorized` over and over.
4. Result: the page gets stuck on “Linking your consult to your account…” or shows a blank/runtime error.

The earlier database permission fix was still correct; this is a different problem.

## Plan
1. Remove the Worker-only dependency on the missing admin secret for the consult result flow.
   - Refactor the result page so signed-in owners load consult + prescription data through the browser client and existing RLS policies instead of `getConsult`.
   - Keep the page usable even if the server helper fails.

2. Rework anonymous consult access into a runtime that can actually verify the anon token.
   - Move anonymous consult read/save/claim behavior out of the current TanStack server-function path that depends on `supabaseAdmin`.
   - Use a dedicated backend function endpoint for anon-token verification and consult lookup/update, since that runtime already has the required secret support.
   - Preserve the current security model: raw anon token stays client-side, only the hash is stored.

3. Fix the broken claim flow.
   - Stop the current auto-claim loop from firing indefinitely on the result page.
   - Update the claim path so authenticated users send their session token explicitly to the backend claim endpoint.
   - After a successful claim, refresh local consult ownership state once and render the prescription page normally.

4. Fix the unlock flow the same way.
   - `unlockEducation` currently has the same auth/header problem as `claimConsult`.
   - Move it to the same authenticated backend pattern so “unlock Owner’s Manual” works reliably.

5. Add safer UI fallbacks.
   - If consult loading fails, show a clear access/error state instead of leaving the screen stuck.
   - Avoid infinite “linking” UI when the claim request fails.
   - Keep the sign-in prompt path intact for users who do not own the consult.

## Files I expect to update
- `src/routes/consult_.$consultId.result.tsx`
- `src/routes/consult_.$consultId.index.tsx`
- `src/lib/consult-server.ts`
- `src/lib/claim-consult.ts`
- `src/components/consult/contact-capture.tsx`
- a new authenticated/anonymous backend endpoint for consult access/claim/unlock

## Technical details
```text
Current broken path:
Result page -> getConsult serverFn -> supabaseAdmin -> missing service-role env -> throw
           -> fallback auto-claim -> claimConsult serverFn -> no auth header -> 401 loop

Planned path:
Signed-in owner -> browser Supabase client + RLS
Anonymous owner -> dedicated backend endpoint with anonToken verification
Claim/unlock    -> explicit authenticated backend request with Bearer token
```

## Verification after implementation
- Open `/consult/<id>/result` while signed in as the consult owner: page loads without runtime error.
- Approved prescriptions render again.
- Pending-review consult no longer gets stuck on “Linking your consult…”.
- Anonymous consult from the original browser still works.
- Claim-after-login succeeds once, then the page refreshes into the normal owner view.
- Unlock Owner’s Manual works for an approved consult.
