

## What's actually happening

The contact-capture form **does** exist and **is** wired up — but it only appears on the **result page** *after* a prescription has been generated. Looking at the database, none of your test consults have a prescription yet (all are `status: draft`). So the form never had a chance to render, and no contact details exist for the expert queue to display.

The `ContactCapture` component renders inside `consult.$consultId.result.tsx`, gated by:
1. `!user` (anonymous only), AND
2. `rx.status === 'pending_review' || 'escalated'` (a prescription must exist)

So you've never seen it because the test flow stops at the chat screen — you'd need to send 3+ replies and click **Generate my recommendation** to reach the page where the form lives.

This is a UX problem, not a "Phase 5 feature." The fix is simple: **also collect contact details on the chat page**, so anonymous patients can leave their email at any point — not only after generation.

## The plan

### 1. Add `ContactCapture` to the chat page (anonymous users only)

In `src/routes/consult.$consultId.tsx`, render a compact contact-capture banner for anonymous users right under the status banner. This way the patient sees it the moment they enter the chat — well before they generate a recommendation.

```text
┌────────────────────────────────────────┐
│ Consult started.  Chat for a few...    │  ← existing
├────────────────────────────────────────┤
│ ✉  How should we reach you?            │  ← NEW (anon only)
│    [name] [email]  [Save]              │
├────────────────────────────────────────┤
│ Intake summary  ▾                      │  ← existing
└────────────────────────────────────────┘
```

After saving, it collapses to a small "We'll email you at x@y.com ✓" pill so it doesn't take up space.

### 2. Detect anonymous state correctly

Use the existing `useAuth()` hook (already imported in the result page) to check `!user`. Skip the form entirely for signed-in users — their email is already on their profile.

### 3. Hide the duplicate on the result page when already captured

On the result page, only render `<ContactCapture>` if the consult's intake doesn't already have `contactEmail`. Fetch that alongside the prescription so we don't ask twice.

### 4. Show "Pending contact" hint to experts

Tiny polish: in `queue-card.tsx`, when an anonymous consult has no `contactEmail` yet, show a subtle "No contact yet" label instead of an empty contact block, so experts know the patient can't be reached.

## Files to change

- `src/routes/consult.$consultId.tsx` — render `ContactCapture` for anonymous users; fetch consult intake to check if email already exists.
- `src/routes/consult.$consultId.result.tsx` — only show `ContactCapture` if no `contactEmail` saved yet.
- `src/components/expert/queue-card.tsx` — show "No contact yet" label when anonymous and no email.

## Why no Phase 5 needed

You asked whether Phase 5+ is required — no. Contact capture is fully implemented backend-wise (server function `saveConsultContact`, RLS policy for anonymous updates, expert queue mapping). The only gap is the form was placed too late in the funnel. Moving it forward to the chat page closes the loop.

