

## Plan — View switcher (Patient ⇄ Expert) + clickable prescription notification

The user is an expert who is also a patient. After signing in, the header pushes them toward the Expert area and the gold dot on Account isn't actionable. Three fixes, all UI-only — no DB, no new routes.

### Problem recap
1. **No explicit "view mode" switch.** A user with `expert` role + their own consults has no way to toggle between *receiving* prescriptions (patient) and *prescribing* (expert).
2. **Account dot is decorative.** It shows the count but clicking just opens `/account` — there's no jump to the actual ready prescription.
3. **Login lands somewhere ambiguous.** Login redirects to `/account`, but the header visually emphasises the Expert link, so dual-role users feel "dropped into expert view".

### Fixes

**1. View-mode toggle in the header (dual-role users only)** — `src/components/site-header.tsx`
- Add a small segmented control next to the Account button, visible only when `isExpert && isAuthenticated`:
  ```
  [ Patient | Expert ]
  ```
- State stored in `localStorage` key `vl_view_mode` (`"patient" | "expert"`), default `"patient"` so signing in always lands a dual-role user in their patient view (matches the user's mental model: "I just signed in to see my prescription").
- Clicking **Patient** → navigates to `/account`, hides the Expert link, shows the Account+ready dot prominently.
- Clicking **Expert** → navigates to `/expert?filter=pending`, hides patient artefacts (ready dot), shows the queue dot.
- The toggle persists across reloads. Single-role users (patient-only or expert-only) never see it.
- Mobile menu gets the same toggle as two large buttons at the top of the auth section.

**2. Make the prescription notification actionable** — `src/components/site-header.tsx` + `src/routes/_authenticated/account.tsx`
- The header dot stays on the Account button (count only).
- Add `?ready=1` when the dot is clicked → `/account?ready=1`. The account page already renders the gold "Your prescription is ready" banner; when `ready=1` is present, scroll-into-view + brief gold pulse on that banner so it's unmissable.
- If exactly **one** prescription is ready, clicking the dot deep-links straight to `/consult/{id}/result` instead of `/account`. We already fetch the count via RLS — extend the query to also grab the most recent ready consult id when count === 1, and store both in state.

**3. Default post-login destination respects view mode** — `src/lib/auth.tsx` + `src/routes/login.tsx` + `src/routes/auth.callback.tsx`
- After successful sign-in, read `vl_view_mode` from localStorage:
  - `"expert"` *and* user has expert role → navigate to `/expert?filter=pending`.
  - Otherwise → `/account` (current behaviour, but now explicit).
- A `?redirect=` search param still wins over both (so the "Sign in to view your prescription" deep-link from the result page keeps working).
- First-time login (no stored mode) defaults to `"patient"` view → lands on `/account`.

### Files

**Modified only — no new files, no DB, no migrations:**
- `src/components/site-header.tsx` — view-mode toggle (desktop + mobile), conditional Expert/Account rendering based on mode, smarter notification dot link (deep-link when count === 1), extend the ready-prescriptions query to also return the latest ready consult id.
- `src/routes/_authenticated/account.tsx` — read `?ready=1` search param, scroll the gold banner into view + add a one-shot `animate-pulse` highlight when present.
- `src/lib/auth.tsx` — small helper `getPreferredLandingPath(roles)` that reads `vl_view_mode` and returns `/expert?filter=pending` or `/account`. Used by `signIn`/`signUp`.
- `src/routes/login.tsx` — use the helper for post-signin navigation when no `?redirect=` is provided.
- `src/routes/auth.callback.tsx` — same helper for the OAuth landing.

### Visual sketch (desktop header, dual-role user)

```text
Logo  ...nav...        [Patient|Expert]   Account ●3
                       └ toggle ─┘        └ clickable dot
```

When the user clicks `Expert` the toggle stores `expert`, the patient dot disappears, and a gold queue badge appears on a re-shown `Expert` link. When they click `Patient`, the Expert link hides and Account + ready dot return.

### Out of scope
- No "expert can act as a patient on their own consults" workflow change — RLS already permits both; this is purely a navigation/affordance fix.
- No persistence of view mode in the database; localStorage is enough for a per-device preference.
- No redesign of the Expert dashboard or Account page beyond the small ready-banner highlight.
- No `viewed_at` tracking (still a deferred follow-up).

