

# Phase 4 — Expert Review Dashboard

## 1. Schema additions (1 small migration)

- Add `claimed_by uuid` + `claimed_at timestamptz` to `prescriptions` (nullable). Used to lock a prescription to one expert during review so two experts don't double-edit.
- Add RLS policy `Prescriptions: experts can update claim` (already covered by existing experts-can-update-all, so no new policy needed — just the columns).
- No other schema changes; `prescription_audit` already exists.

## 2. Server functions (`src/lib/expert-server.ts`)

All use `requireSupabaseAuth` middleware + check `has_role(userId, 'expert'|'admin')` server-side via the authenticated supabase client (RLS enforces it, but we double-check and return 403 on failure).

- `listQueue({ filter: 'pending'|'escalated'|'mine'|'all' })` → joins `prescriptions` + `consults` + author profile, returns id, status, created_at, claimed_by, intake summary, red_flags count.
- `getReviewDetail({ prescriptionId })` → returns `{ prescription, consult, messages[], audit[] }`.
- `claimPrescription({ prescriptionId })` → sets `claimed_by=userId, claimed_at=now()` only if currently unclaimed (conditional update); writes `claim` row to `prescription_audit`.
- `releasePrescription({ prescriptionId })` → clears claim if owned by caller.
- `approvePrescription({ prescriptionId, final, notes? })` → status=`approved`, `final` jsonb, `reviewed_by/at`, also flips parent `consults.status='approved'`. Writes `approve` audit row with diff (draft → final).
- `rejectPrescription({ prescriptionId, notes })` → status=`rejected` + consult `rejected`. Audit `reject`.
- `escalatePrescription({ prescriptionId, notes })` → status=`escalated` + consult `escalated`. Audit `escalate`.

Each mutation re-checks the caller still owns the claim (or that nobody owns it, for approve from unclaimed state we'll require claim first in UI).

## 3. Routes

**`/expert`** (replace placeholder at `src/routes/_authenticated/_expert/expert.tsx`)
- Tabs: Pending · Escalated · Mine · All (drives `filter` search param via `validateSearch`).
- Card list, mobile-friendly: status badge, age ("3h ago"), top symptoms, red-flag chip if any, claimed-by avatar/initials.
- Empty state: "Queue is clear."
- Realtime subscription on `prescriptions` (insert/update) → `router.invalidate()` so the list refreshes when another expert claims/approves.

**`/expert/$prescriptionId`** (new file `src/routes/_authenticated/_expert/expert.$prescriptionId.tsx`)
- Three-section layout (stacked on mobile, two-column ≥md):
  1. **Intake summary** — pretty-rendered from `consults.intake` jsonb, plus consult age and author email/display name.
  2. **Conversation** — full `consult_messages` list using existing `ChatMessage` component, scrollable, read-only.
  3. **Draft recommendation editor** — form initialized from `prescription.draft`. Each recommendation card is editable: title, modality (select), rationale (textarea), products (add/remove rows: name/form/dosage/notes), safety_notes, citations (one per line). Plus top-level `summary`, `red_flags` chips, `escalate` toggle.
- Action bar (sticky bottom on mobile):
  - If unclaimed → **Claim for review** (primary). Other actions disabled.
  - If claimed by current user → **Approve**, **Reject** (requires notes), **Escalate** (requires notes), **Release**.
  - If claimed by someone else → read-only banner "Claimed by {name} — only they can act."
- Audit trail panel (collapsible at bottom): list of `prescription_audit` rows with actor, action, timestamp.

## 4. Header & UX touches

- Header already shows "Expert" link for experts/admins (Phase 2). Add a small queue-count badge — fetched via lightweight server fn `getQueueCount()` cached 30s.
- Toasts via `sonner` for every action result (success / failure / "another expert just claimed this").

## 5. Account page additions

- The user-side `account.tsx` already lists consults; once approval flips `consults.status='approved'` the existing UI just works. No changes needed beyond confirming the status badge styles cover all five statuses.

## 6. Realtime updates on result page

- Add a `supabase.channel` subscription on `prescriptions` filtered by `consult_id` to `src/routes/consult.$consultId.result.tsx` so users awaiting review auto-transition to the approved view without refresh.

## 7. Files

**New**
- `src/routes/_authenticated/_expert/expert.$prescriptionId.tsx`
- `src/lib/expert-server.ts` (all server fns above)
- `src/components/expert/queue-card.tsx`
- `src/components/expert/recommendation-editor.tsx`
- `src/components/expert/audit-trail.tsx`
- One migration: add `claimed_by`, `claimed_at` columns to `prescriptions`

**Edit**
- `src/routes/_authenticated/_expert/expert.tsx` (replace placeholder with real queue + tabs + realtime)
- `src/components/site-header.tsx` (queue-count badge for experts)
- `src/routes/consult.$consultId.result.tsx` (realtime auto-refresh on approval)

## 8. Out of scope (Phase 5)
Email/SMS notifications when prescription approved, senior-expert escalation routing, expert performance analytics, marketplace (Pillar 3), education packages (Pillar 4).

