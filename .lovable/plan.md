
I reviewed the relevant files plus the network trace, and the core issue is now clear:

1. The approved prescription does exist.
2. The patient account shows nothing because the consult was never actually attached to the signed-in user (`consults.user_id` is still `null`).
3. The header notification is using prescription-level data that dual-role users can read as experts, so it looks “ready” even when the patient-side ownership handoff failed.
4. The claim flow is split across two different storage keys (`vl_consult_id` in `localStorage` and `pendingConsultId` in `sessionStorage`), so the redirect/claim logic is inconsistent.

The network evidence confirms this:
- approved prescription rows exist
- the consult linked to that prescription still has `user_id = null`
- account consult query returns `[]`, so the patient banner has nothing to show

## Plan — Fix consult claiming + make patient prescription access actually actionable

### 1. Unify the anonymous-to-account claim flow
Update `src/lib/claim-consult.ts` so there is one source of truth for a pending consult:
- read both legacy keys for backward compatibility
- clear both after a successful claim
- expose one helper used everywhere

Then update:
- `src/routes/consult.tsx`
- `src/routes/consult_.$consultId.result.tsx`
to use the same helper instead of writing different keys in different places.

### 2. Make auth redirect to the claimed consult before anything else
Update:
- `src/lib/auth.tsx`
- `src/routes/login.tsx`
- `src/routes/signup.tsx`
- `src/routes/auth.callback.tsx`

So after sign-in/sign-up/OAuth:
- if a consult was successfully claimed, go straight to `/consult/$consultId/result`
- otherwise fall back to the existing patient/expert landing logic

This prevents users from signing in and then landing somewhere unrelated while their prescription is still hidden.

### 3. Add a self-healing claim attempt on the result page
Update `src/routes/consult_.$consultId.result.tsx` so that when a signed-in user lands on a consult result page and that consult is still unclaimed:
- if it matches the remembered pending consult, attempt to claim it immediately
- only show the auth gate if that recovery path fails

This makes the result page resilient even if the redirect sequence is imperfect.

### 4. Fix the header notification to use patient-owned consults, not expert-readable prescriptions
Update `src/components/site-header.tsx`:
- in patient view, compute ready items from the user’s consults (or unique consult IDs), not raw approved prescription rows
- dedupe by consult so one consult with multiple approved prescription rows does not break the “single ready prescription” deep link
- keep the Expert queue logic separate from patient-ready logic

This will stop false/broken notification states for dual-role users.

### 5. Make the header action explicitly actionable
Also in `src/components/site-header.tsx`:
- keep `Account` as a stable link to `/account`
- add a distinct prescription-ready action/pill/badge beside it when there is something ready
- if exactly one ready consult exists, link directly to that result page
- if multiple exist, link to the ready banner on account

This removes the current ambiguity where “Account” and the notification are bundled into one weak action.

### 6. Strengthen the account page ready banner
Update `src/routes/_authenticated/account.tsx`:
- ensure the banner is driven by patient-owned consults only
- preserve the highlight/scroll behavior for `?ready=1`
- show a clear empty state if the user is authenticated but nothing has been claimed yet
- optionally add a small fallback notice if a pending consult is detected but not yet attached, so the UI doesn’t feel broken

## Files to modify
- `src/lib/claim-consult.ts`
- `src/lib/auth.tsx`
- `src/routes/consult.tsx`
- `src/routes/consult_.$consultId.result.tsx`
- `src/routes/login.tsx`
- `src/routes/signup.tsx`
- `src/routes/auth.callback.tsx`
- `src/components/site-header.tsx`
- `src/routes/_authenticated/account.tsx`

## No backend schema changes needed
This looks like a flow/ownership bug, not a table-design problem:
- the prescription exists
- the patient can’t see it because the consult was never claimed
- current RLS is doing what it should

## Expected result after this fix
For a dual-role user:
- signing in after a consult claims the consult reliably
- patient view shows the consult on account
- the ready banner appears correctly
- the ready notification becomes a real action
- clicking it opens the prescription instead of sending the user into a dead end
