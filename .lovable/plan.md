

## Diagnosis

You haven't been seeing a contact form during intake because today the form lives only on the **chat page** and **result page** — both come *after* the 5-step intake stepper. So the moment you tap "Begin consult", you skip past any contact prompt and head straight into the AI chat. If you're signed in (even as the expert), the chat-page form is also hidden by `!user`, which is why every test consult in the database has `contactEmail = null`.

You answered: **show the form as a final intake step + keep a fallback at later points**. Here is what we'll change.

## Plan

### 1. Add a 6th step to the intake stepper — "How to reach you"

In `src/components/consult/intake-stepper.tsx`:
- Bump `total` from 5 to 6 and add a `"Contact"` label.
- Add `contactName` + `contactEmail` to the local `intake` state.
- New step body: name (optional) + email (required, validated with a simple regex).
- `canNext` for step 5 requires a valid email.
- The final "Begin consult" button moves to step 6.

```text
Steps: Symptoms → Timing → Lifestyle → Safety → Goals → Contact
                                                         ▲ NEW
                                                  [name] [email]  Begin consult
```

For signed-in users we **prefill** `contactEmail` from `user.email` and `contactName` from the profile display name, but still show the step so they can confirm or edit (you said "use account email" earlier; this respects that while leaving an explicit confirm). If you'd rather skip the step entirely when signed in, we can hide it behind `!user`.

### 2. Persist contact details with the consult on creation

`src/lib/consult-server.ts → startConsult` already stores the entire `intake` JSON. Because the new `contactEmail`/`contactName` live inside `Intake`, **no server change is required** — the values flow into `consults.intake` automatically. The expert queue (`queue-card.tsx`) and detail view (`expert.$prescriptionId.tsx`) already read these exact keys, so they will appear immediately.

### 3. Keep the chat-page banner as a fallback

`src/routes/consult.$consultId.tsx` already conditionally shows `<ContactCapture>` when `intake.contactEmail` is missing. With step 1 in place this banner will normally stay hidden, but it remains a safety net for any consult that somehow lands without an email (e.g. older rows, future skip-paths).

### 4. Tiny polish

- Update the consult page's submitting copy/toast to mention "We'll email you when your recommendation is ready."
- In `expert.tsx` Drafts tab empty state, reword to make clear drafts now arrive *with* contact info.

## Files to change

- `src/components/consult/intake-stepper.tsx` — add Contact step, prefill from auth, validate email, bump total to 6.
- `src/routes/consult.tsx` — pass `user.email`/profile name as initial contact values to the stepper; minor copy.
- `src/lib/consult-server.ts` — no logic change; only confirm types already include `contactEmail`/`contactName` (they do).
- `src/routes/_authenticated/_expert/expert.tsx` — small copy tweak in Drafts empty state.

No DB migration, no RLS changes, no new server function — the schema and policies already support this.

## Why this fixes what you saw

Right now: intake → chat → (form hidden because you were signed in) → no email saved → expert queue shows "NO CONTACT YET".
After: intake → **Contact step (required)** → chat → expert queue shows the patient's name and email on every card.

