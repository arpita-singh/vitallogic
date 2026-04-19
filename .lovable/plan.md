

## What's actually happening

The user IS holding a session in localStorage that the client thinks is valid, but the auth server has lost/revoked it. Auth logs since 14:37 UTC show dozens of `403 "session id (d4712b33-...) doesn't exist"` errors against `/user`. The client never notices because:

- `supabase.auth.getSession()` returns the cached session from localStorage without revalidating.
- `auth.tsx` only sets `user = null` when an `onAuthStateChange` event fires — and a server-side session deletion does not always trigger one if the access token is still within its 1-hour window.
- The result page sees `user` truthy → calls `readConsult` → edge function calls `admin.auth.getUser(stale_token)` → gets no user → returns 401 → page shows "Sign in to view" gate, but the user IS signed in, causing the loop visible in the video. Same story for `claimSpecificConsult` and `claimPendingConsult`.

So the symptom — "I'm signed in but can't view my prescription" — is exactly correct.

## The fix

**1. Detect stale sessions on the client and force a clean sign-out.**

In `src/lib/auth.tsx`, after `getSession()` returns a session on initial load, call `supabase.auth.getUser()` once to ask the server to validate the access token. If the server returns no user (session revoked / expired refresh), call `supabase.auth.signOut({ scope: "local" })` to clear localStorage so the UI correctly reflects "signed out", then redirect to login if needed.

**2. Recover gracefully on the result page when the edge function returns 401 despite `user` being non-null.**

In `src/routes/consult_.$consultId.result.tsx`, when `readConsult` throws `Unauthorized` AND `user` is truthy, treat it as a stale-session signal: call `supabase.auth.signOut({ scope: "local" })`, then re-render. This stops the claim loop and surfaces the proper "Sign in to view your prescription" gate, where the user can actually re-authenticate.

**3. Stop the toast spam from `claimSpecificConsult`.**

The `useRef` guard already prevents the React loop from re-firing, but the original error toast from a 401 should be silenced (it's an expected failure mode now — only log it at warn level, no toast).

**4. Same treatment in `account.tsx` for `claimPendingConsult` 401s.**

Don't surface error toasts when the failure is a stale-session 401; trigger the same local sign-out and reload.

## Why this is correct, not a workaround

A 401 from `admin.auth.getUser(token)` definitively means the client's stored token is no longer valid. The only correct response is to clear the stale session locally so the UI matches reality. The server has already invalidated this session — there is nothing to "fix" server-side. The user can then sign back in cleanly and the existing claim/result flow takes over (verified to work in the previous QA pass).

## Files to change

- `src/lib/auth.tsx` — add a one-time server-side validation on init; sign out locally if stale.
- `src/routes/consult_.$consultId.result.tsx` — handle 401 from `readConsult` as stale-session.
- `src/routes/_authenticated/account.tsx` — same handling for `claimPendingConsult` 401.
- `src/lib/claim-consult.ts` — return a structured result distinguishing "stale session" from "ownership denied" so callers can react correctly.

## Out of scope

- No edge function changes. No database/RLS changes. The `consult-access` function is correct.
- No change to the anonymous-token flow. That's already verified working.

## Verification

After implementing, in the same browser tab the user is currently in:
1. The page should auto-detect the dead session, sign them out locally, and show the "Sign in to view your prescription" gate within ~1s of load (no toast spam).
2. After signing back in, `readConsult` succeeds, the prescription page renders, no claim loop.
3. Auth logs should stop showing the repeating `session_not_found` 403s for the d4712b33/b0e3085e sessions.

