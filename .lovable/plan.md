

The account page (`src/routes/_authenticated/account.tsx`) already lists consults with status badges and links to `/consult/{id}/result`. What's missing is a **prominent banner at the top** that surfaces *actionable* consults — specifically those with an approved prescription waiting to be viewed — so the patient sees them immediately on landing.

## Plan — Approved-prescription banner on account dashboard

### What changes

`src/routes/_authenticated/account.tsx` only — no new files, no DB changes.

### Approach

1. **Extend the consults query** to also fetch related prescriptions in one round-trip:
   ```
   .select("id, status, created_at, prescriptions(id, status, reviewed_at)")
   ```
   RLS already allows the patient to see their own approved prescriptions via the existing `Prescriptions: owner sees approved` policy, so anything that comes back is viewable.

2. **Compute "ready" consults** — those with at least one prescription where `status = 'approved'`.

3. **Render a gold-accented banner** above the existing "Your consults" section when `readyConsults.length > 0`:
   - Headline: *"Your prescription is ready"* (singular) or *"You have N prescriptions ready to view"* (plural).
   - Subtext: *"Your practitioner has approved your recommendations."*
   - For each ready consult, a row with the consult date + a primary "View prescription" button linking to `/consult/$consultId/result`.
   - Styling: `border-gold/40 bg-gold/5` card matching the existing Sunny Goth tokens (consistent with the expert-dashboard card already on the page).
   - Dismissable: no — these are actionable, should stay until viewed. (Could add a "viewed_at" tracker later if needed; out of scope now.)

4. **Preserve existing list** — the full consults list below the banner stays unchanged so patients still see drafts / pending review / older consults with their status badges.

5. **Empty/loading states** — if no ready consults, banner simply doesn't render. No loading skeleton needed (the page already renders synchronously around the consults fetch).

### Layout sketch

```text
┌───────────────────────────────────────────┐
│ Hello, {name}                             │
│ {email}    [role chips]                   │
├───────────────────────────────────────────┤
│ ★ Your prescription is ready              │  ← NEW gold banner
│   Your practitioner has approved...       │
│   • Apr 12 consult   [View prescription →]│
├───────────────────────────────────────────┤
│ Your consults                  + New      │  ← existing
│   ...existing list...                     │
└───────────────────────────────────────────┘
```

### Out of scope
- No "mark as read" / dismissal persistence.
- No notification dot on `site-header` (could be a follow-up).
- No real-time subscription — page reload reflects new approvals (good enough for v1).

