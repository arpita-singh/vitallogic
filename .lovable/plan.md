

## Plan — Review modal + sign-up flow for unauthenticated patients

Two parts, no email needed yet.

---

### Part 1 — Prescription review modal (pre-send gate)

New component `src/components/expert/prescription-review-modal.tsx`:
- shadcn `Dialog` (already installed).
- Trigger: replace the current bare "Approve" button in `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx` with **"Review & approve"**.
- Body renders a **patient-facing preview** built from the live `edit` + `attachedProducts` state, mirroring exactly what `consult_.$consultId.result.tsx` shows (summary, red flags, each recommendation card with rationale/safety/citations, attached product cards). Wrapped in a "Patient preview" frame so the expert knows it's a preview.
- Footer: `Back to edit` (close) and `Approve & publish` (primary, gold).
- `Approve & publish` runs the existing approve mutation unchanged (status, final, attached_products, reviewed_*, audit row). On success: toast "Approved — patient will see this on sign-in", close modal, page transitions to the resolved/approved view.
- A small "Patient access" notice in the modal footer: *"Patient must sign in or sign up with the email used at intake to view this prescription."* — sets expectations until email is wired.

Existing inline editor on the page stays intact — modal is the final gate, not a replacement.

---

### Part 2 — Sign-up / sign-in for unauthenticated patients viewing a result

**Problem today:** when an anonymous user finishes a consult, their consult has `user_id = null`. Even after expert approval, they can't see the prescription because the RLS policy `Prescriptions: owner sees approved` requires `consults.user_id = auth.uid()`.

**Fix — gated result view + claim-on-signin:**

1. **`src/routes/consult_.$consultId.result.tsx`** — add an auth/ownership gate at the top:
   - If consult `user_id IS NULL` (anonymous) OR the current user doesn't own it → render a **"Sign in to view your prescription"** card instead of the result body.
   - The card explains: "Your practitioner is reviewing your consult. Sign in or create an account with the email you used at intake to receive your prescription."
   - Two CTAs: **Sign in** and **Create account**, each linking to `/login?redirect=/consult/{id}/result` and `/signup?redirect=/consult/{id}/result&email={intake.contactEmail}` so the user lands back here after auth.

2. **Auto-claim anonymous consult on auth** — new helper `src/lib/claim-consult.ts`:
   - Reads pending consult id from `sessionStorage` key `pendingConsultId` (set whenever the result page detects an anonymous consult).
   - After successful sign-in / sign-up / OAuth callback, if the stored consult is still `user_id IS NULL`, run `update consults set user_id = auth.uid() where id = ? and user_id is null` (already permitted by the existing `Consults: claim anonymous` RLS policy).
   - Clear the storage key, navigate to `/consult/{id}/result`.
   - Hook this helper into `src/lib/auth.tsx`'s `signIn` / `signUp` success paths and into a new `/auth/callback` handler the OAuth providers redirect to (TanStack route file `src/routes/auth.callback.tsx`).

3. **Login + Signup pages — add social sign-in buttons** (`src/routes/login.tsx`, `src/routes/signup.tsx`):
   - Existing email + password forms stay.
   - Add three branded buttons under a divider: **Continue with Google**, **Continue with Apple**, **Continue with Facebook**.
   - Lovable Cloud supports Google + Apple natively (managed credentials, no setup needed). **Facebook is NOT supported by Lovable Cloud's managed auth** — I'll explain in the modal/UI that Facebook requires the external Supabase integration to enable, and either:
     - **(a)** Ship Google + Apple now (recommended — zero setup, works immediately), OR
     - **(b)** Also add Facebook with a "Coming soon" disabled state until the user opts to wire it up via the Supabase dashboard.
   - Default: ship Google + Apple as live buttons; Facebook as a disabled "Coming soon — requires extra setup" button so the design is in place. I'll surface this clearly to the user before building.

4. **Use Lovable's managed OAuth helper** — call `lovable.auth.signInWithOAuth("google" | "apple", { redirect_uri: window.location.origin + "/auth/callback" })`. The configure-social-login tool will scaffold `src/integrations/lovable/` and install `@lovable.dev/cloud-auth-js` automatically — I won't hand-write that module.

5. **`/auth/callback` route** — receives the post-OAuth redirect, runs `claimPendingConsult()`, then navigates to the stored `redirect` search param (or `/`).

---

### Files

**New:**
- `src/components/expert/prescription-review-modal.tsx`
- `src/lib/claim-consult.ts`
- `src/routes/auth.callback.tsx`
- (auto-created by social-login tool) `src/integrations/lovable/index.ts` + package install

**Modified:**
- `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx` — swap Approve → modal trigger
- `src/routes/consult_.$consultId.result.tsx` — auth/ownership gate + sign-in CTAs + sessionStorage write
- `src/routes/login.tsx` — add social buttons + redirect-back support (already partially there)
- `src/routes/signup.tsx` — add social buttons + email prefill from search param
- `src/lib/auth.tsx` — call `claimPendingConsult()` after successful signIn/signUp

**No DB migration needed** — existing `Consults: claim anonymous` RLS policy already supports the claim flow, and the `Prescriptions: owner sees approved` policy already gates result visibility correctly.

### Out of scope
- Email delivery (deferred until domain is ready).
- Facebook live button (Lovable Cloud doesn't manage it; will appear as "Coming soon" until user opts into Supabase-dashboard setup).
- Phone/SMS sign-in (not requested).

