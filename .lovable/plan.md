

## What's actually happening

I checked the data. Two real problems, both UX gaps in the current design — nothing is bug-broken.

### Problem 1 — Expert can't click "In progress" drafts

In `src/components/expert/queue-card.tsx` lines 118–120, draft items are rendered as a plain `<div>` instead of a `<Link>`:

```tsx
if (item.isDraft) {
  return <div className={cardClass}>{inner}</div>;
}
```

This is intentional — the expert detail page (`/expert/$prescriptionId`) is keyed on a prescription ID, and drafts have no prescription row yet. So there's literally nowhere for the link to go.

### Problem 2 — Patient doesn't see their draft consult

Database confirms it. User `arpita.singh.syd@gmail.com` (id `c39d32f2…`) has:

- 1 approved consult (`c556559a…`) — visible on her account ✅
- The "Digestion" draft (`ca60a163…`) you see in the expert queue has `user_id = NULL` — it was started **anonymously**, contact email `arpita.singh.syd@gmail.com` was captured, but it was never claimed to her account.

Her account page only queries `consults WHERE user_id = <her id>`, so anonymous drafts aren't visible. The "one consult at a time" perception is correct under the current rules: anonymous consults attach to your account only when (a) you sign up/in with the same browser session that started them (via the `vl_pending_consult_id` localStorage pointer), or (b) you open the consult URL directly.

So she has multiple consults — the system just doesn't link them to her account because they were started in different browser sessions without the localStorage pointer.

## The fix — two narrowly-scoped changes

### Fix 1 — Make draft consults openable from the expert queue

Add a new expert route `/expert/consult/$consultId` that shows the in-progress consult (intake + chat history so far + contact details) as **read-only**, with one primary action: "Generate prescription now". Clicking it calls the existing `generate-prescription` edge function, creates the `prescriptions` row, and redirects to the normal `/expert/$prescriptionId` review screen.

In `queue-card.tsx`, change the draft branch to a `<Link to="/expert/consult/$consultId">` instead of the plain `<div>`.

This unblocks the expert to: see what the patient said, contact them via the captured email, or push them through to a draft prescription manually.

### Fix 2 — Auto-attach anonymous consults by email when a matching user signs in

When a user signs in or signs up, after the existing `claimPendingConsult` (which uses the localStorage pointer), also run a server-side lookup: any `consults` row where `user_id IS NULL` AND `intake->>'contactEmail' = <signed-in user's email>` gets attached to their account.

This is **opt-in by behavior** — the patient already typed their email into the consult form, so attaching by email match is exactly what they expect. We do it server-side in a new `consult-access` action `claimByEmail` (using the auth-validated JWT email; never trusting client-supplied email) so we don't widen RLS.

Account page now shows all of Arpita's consults — both the historical approved one and any drafts she started anonymously.

## Files I'll touch

- `src/components/expert/queue-card.tsx` — make draft cards link to the new route
- `src/routes/_authenticated/_expert/expert_.consult.$consultId.tsx` — new read-only draft viewer + "Generate prescription" action
- `supabase/functions/consult-access/index.ts` — add `claimByEmail` action: find unattached consults matching the caller's verified email, set `user_id` to the caller
- `src/lib/consult-access.ts` — add `claimByEmail()` client wrapper
- `src/lib/auth.tsx` — call `claimByEmail()` after `claimPendingConsult()` in both `signIn` and `signUp`
- `src/routes/_authenticated/account.tsx` — also call `claimByEmail()` on mount as a safety net for already-signed-in users (covers Arpita's case right now)

## Out of scope

- No schema changes, no new tables, no RLS rewrites.
- Not building "merge two accounts" — only attaches anonymous (`user_id IS NULL`) consults; never reassigns one user's consults to another.
- Not auto-claiming prescriptions in the expert queue (that's a separate workflow decision).

## Verification once shipped

1. **Expert side:** click the "Digestion" draft card → land on the new draft viewer → see Arpita's intake + email + any chat → optionally click "Generate prescription" and land on the standard review page.
2. **Patient side:** Arpita refreshes `/account` → the Digestion draft now appears under "Your consults" with status "In progress" and links to `/consult/ca60a163…` so she can finish it.
3. **Safety:** start a new anonymous consult with a random email, sign in as Arpita, confirm that consult does NOT attach (email mismatch).

