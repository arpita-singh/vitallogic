

## Plan — Make sign-in obvious + surface prescriptions clearly

The user can't see how to sign in from desktop, and once signed in, finding an approved prescription isn't obvious. Two small, focused fixes — header + homepage.

### Problem analysis

1. **Desktop header (`site-header.tsx`) has no "Sign in" link** when logged out — only a "Start consult" button. Mobile menu has it; desktop doesn't.
2. **Homepage CTAs** ("Start your free consult", "Read our philosophy") never mention "I already have a consult — show me my prescription". A returning patient lands on `/` and has no clear path.
3. **Account page** does have the gold "prescription ready" banner (added last turn), but the user has to *get there* first — which requires knowing to sign in.

### Fixes

**1. `src/components/site-header.tsx` — add desktop Sign in link (logged-out state)**
- Insert a `Sign in` text link to the left of the "Start consult" button on desktop (`sm:inline-flex`).
- Style: subtle text link matching the nav items (`text-sm text-muted-foreground hover:text-foreground`), with a small "user" icon optional.
- Keeps the gold "Start consult" as the primary CTA; "Sign in" is the secondary path for returning users.
- Mobile menu already has both — no change needed there.

**2. `src/components/site-header.tsx` — add "My prescription" quick link (logged-in state)**
- When `isAuthenticated`, the header currently shows `Account` button only. Add a small `Account` link that already covers it, but rename/restructure so the Account button itself feels like the prescription destination — OR simpler: leave Account as-is (the gold banner inside `/account` already surfaces prescriptions prominently). The real fix is making sure the user *gets to* `/account` easily, which the existing button does once they sign in.
- No change needed here beyond fix #1, since once signed in the Account button is already visible and the dashboard banner does the rest.

**3. `src/routes/index.tsx` — add a returning-patient hint near the hero CTAs (logged-out only)**
- Below the two hero buttons, add a single small line: *"Already had a consult? <Link to='/login'>Sign in to view your prescription</Link>"* — muted text with the link in gold.
- Only render when not authenticated (use `useAuth()` to check).
- Zero visual clutter, but makes the path discoverable for the exact case the user described.

**4. `src/routes/index.tsx` — replace the bottom "Begin your first consult" CTA with a dual-path version (logged-out only)**
- Keep the "Start now" button as primary.
- Add a secondary link beside/below it: *"Returning? Sign in →"* linking to `/login`.
- When logged-in, swap the whole block to point to `/account` with copy like *"View your dashboard"* so the same CTA real estate stays useful for returning users.

### Files

**Modified:**
- `src/components/site-header.tsx` — add desktop "Sign in" link in the logged-out branch (one new `<Link>`).
- `src/routes/index.tsx` — import `useAuth`, add a small returning-patient line under hero CTAs, and swap the bottom CTA based on auth state.

**No new files. No DB changes. No route changes.**

### Out of scope
- No header redesign / no dropdown menu (overkill for two links).
- No "prescription ready" notification dot on the header (mentioned as a follow-up suggestion last turn — separate task if wanted).
- No copy changes to login/signup pages themselves (they already work; the issue is discoverability, not the pages).

