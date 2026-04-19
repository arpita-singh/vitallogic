
## Plan — Fix the patient prescription loop and make the ready action open the actual approved result

### What I found
The bug is real, and the main cause is now clear from the code plus the recorded requests:

1. A single consult can accumulate multiple prescription rows over time.
2. The header/account treat a consult as “ready” if it has any approved prescription.
3. But the patient result page currently loads the most recently created prescription row for that consult, not the correct patient-facing one.
4. So if a consult has an older approved prescription and a newer pending draft, the header says “ready” but the destination resolves to the wrong state.
5. That mismatch is what makes the flow feel looped and broken.

The network trace confirms this exact pattern: one consult has several prescriptions, including approved and pending_review rows at the same time.

### Implementation
#### 1) Make the patient result page load the right prescription
Update `src/routes/consult_.$consultId.result.tsx` so it no longer fetches “latest by created_at”.

Instead, it should resolve the patient-facing prescription with a clear priority:
1. approved
2. rejected
3. escalated
4. pending_review

For a patient arriving from the header/account, approved must win over any newer draft. This is the most important fix.

#### 2) Stop the consult from bouncing users back into the wrong experience
Update `src/routes/consult_.$consultId.tsx` so the consult/chat page detects if the consult already has an approved prescription.

If approved exists:
- show a prominent “View approved prescription” CTA
- prevent the user from getting pushed back into the chat/generate loop
- optionally auto-redirect to `/consult/$consultId/result` when appropriate

This removes the “I keep landing back in the chatbot” feeling.

#### 3) Make the ready pill use patient-facing resolution
Update `src/components/site-header.tsx` so the gold ready action is driven by the same patient-facing logic as the result page.

That means:
- keep counting ready consults, not raw prescription rows
- but only deep-link to consults whose patient-facing state is actually approved
- ensure the button remains its own distinct clickable action, separate from the Account link

#### 4) Make Account explicitly show “View prescription” vs generic consult navigation
Update `src/routes/_authenticated/account.tsx` so each ready consult gets a clear prescription action.

For consults with approved prescriptions:
- primary action: `View prescription`

For consults still under review:
- secondary/status-only presentation, not misleading navigation

This will make patient navigation obvious even if a user skips the header pill.

#### 5) Prevent duplicate draft confusion at the source
Update the prescription generation flow so repeated generation doesn’t keep creating ambiguous patient states.

Likely changes:
- review `supabase/functions/generate-prescription/index.ts`
- review `src/routes/consult_.$consultId.tsx`

Preferred behavior:
- reuse/update the current in-progress prescription for a consult when appropriate
- avoid piling up extra pending rows once a consult already has a visible approved result, unless that is an intentional expert-side revision flow

This reduces future recurrence of the bug.

### Files to modify
- `src/routes/consult_.$consultId.result.tsx`
- `src/routes/consult_.$consultId.tsx`
- `src/components/site-header.tsx`
- `src/routes/_authenticated/account.tsx`
- `supabase/functions/generate-prescription/index.ts`

### Technical notes
- No database schema changes are required for the main fix.
- The core issue is query/selection logic, not missing data.
- The patient route is consult-based, so it must deterministically choose the correct prescription row for display.
- I will keep expert review behavior intact while separating patient-visible state from expert drafting state.

### Expected result after the fix
- The gold “Prescription ready” action opens the approved prescription, not the wrong consult state.
- Account shows a clear, patient-friendly path to the approved result.
- The consult/chat page stops trapping users in a loop once a prescription is already approved.
- Dual-role users can still switch views, but patient navigation becomes direct and reliable.

### Out of scope
- No redesign of the whole expert workflow.
- No new database tables.
- No notification history/read-state system in this pass.
