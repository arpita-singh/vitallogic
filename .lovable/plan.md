

## Plan — Pre-flight prescription edit + email delivery

The user wants two things before approving sends a prescription to the patient:
1. **A focused "edit & finalise" module** — the existing right-column editor is fine for inline tweaks, but there's no clear "review what the patient will actually see" moment before hitting Approve.
2. **Email the approved prescription to the patient** — currently Approve just flips the status; the patient only finds out by reloading their result page.

---

### Step 1 — Email infrastructure (prerequisite)

The project has zero email setup today (no `src/lib/email-templates/`, no email server routes, no email domain). To send emails from the app we need a verified sender domain first.

I'll surface the Lovable email setup dialog so the user can configure a sender domain. Once that's done (status `awaiting_dns` is fine — we don't need full DNS verification to scaffold/code), I'll:
- run `setup_email_infra` to provision queues + tables + cron
- run `scaffold_transactional_email` to create the send route + template registry
- create `src/lib/email-templates/prescription-approved.tsx` — a React Email template that renders:
  - greeting with the patient's name
  - practitioner summary
  - each recommendation (title, modality, rationale, safety notes)
  - attached marketplace products (name, vendor, AUST‑L, price, dosage notes)
  - reviewer notes (if any)
  - a "View your full recommendation" button linking to `/consult/{id}/result`
  - matches Sunny Goth palette (gold accent on white body — required by email rules)

---

### Step 2 — Prescription review modal (pre-send)

New component `src/components/expert/prescription-review-modal.tsx`:
- shadcn `Dialog` triggered by a new "Review & send to patient" button (replaces the current bare "Approve" button).
- Renders the **exact patient-facing layout** using the in-memory `edit` + `attachedProducts` state (so the expert sees what the patient will see, including products and reviewer notes), wrapped in a "Patient preview" frame.
- Below the preview, a recipient block:
  - shows resolved patient email (from `consult.intake.contactEmail` or the consult owner's profile email)
  - editable input if the email is missing or wrong
  - a "Send copy to me as well" checkbox (sends to the reviewing expert too)
- Footer actions: `Back to edit` (close) and `Approve & send` (primary).

The existing inline editor stays — this modal is the final gate, not a replacement.

---

### Step 3 — Wire approve → send email

Update `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx`:
- Replace the current Approve button with `Review & send to patient` opening the modal.
- The modal's `Approve & send` runs the existing approve mutation (status, final, attached_products, reviewed_*, audit), then calls a small client helper `sendPrescriptionEmail({ prescriptionId, recipientEmail, ccExpert })` which POSTs to the `send-transactional-email` server route with:
  - `templateName: "prescription-approved"`
  - `recipientEmail`
  - `idempotencyKey: prescription-approved-${prescriptionId}`
  - `templateData: { patientName, summary, recommendations, products, reviewNotes, resultUrl }`
- After enqueueing, write a new `prescription_audit` row `action: "email_sent"` with `diff: { recipient, ccExpert }` so the audit trail captures it.
- Toast `Approved and emailed to {patient}` on success; `Approved (email failed — try resend)` if the enqueue fails (the approval still stands — failures are non-blocking).

A small "Resend email" button appears on already-approved prescriptions in case the first send failed or the patient lost it.

---

### Step 4 — Public unsubscribe page

Required by the transactional-email scaffolding: `src/routes/unsubscribe.tsx` reads the `?token=` param and renders a branded confirm/success/already-done state, calling the scaffolded `/email/unsubscribe` endpoints.

---

### Files

**New:**
- `src/components/expert/prescription-review-modal.tsx`
- `src/lib/email-templates/prescription-approved.tsx`
- `src/lib/email/send.ts` (thin helper for the send route)
- `src/routes/unsubscribe.tsx`
- (auto-created by scaffolding tool) `src/routes/lovable/email/...` server routes + `src/lib/email-templates/registry.ts`

**Modified:**
- `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx` (swap Approve → modal trigger; add resend button on resolved state)

**No DB migration needed** — `prescription_audit` already supports the new `email_sent` action via free-form `action` text.

### Out of scope
- No SMS / no in-app notification.
- No rich PDF attachment (Lovable email infra doesn't support attachments — the email links back to the result page, which already renders the full prescription).
- No marketing/newsletter tooling.

The first step is configuring an email sender domain — that's a one-time setup. Once that's in place, everything above can be built and tested.

<lov-actions>
<lov-open-email-setup>Set up email domain</lov-open-email-setup>
</lov-actions>

