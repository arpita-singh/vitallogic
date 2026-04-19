
The user wants me to:
1. Derive test cases from the README's documented user journeys
2. Run automated browser tests against the live preview
3. Report results

This requires `browser--*` tools (navigate, act, observe, screenshot) which are unavailable in plan mode. I need approval to proceed.

## Test scope (derived from README)

Three key user journeys are documented:

### Journey 1 — Anonymous patient intake
- Navigate to `/consult` (incognito-equivalent: signed-out session)
- Complete all 6 intake steps: Symptoms → Timing → Lifestyle → Safety → Goals → Contact
- Submit and verify redirect to `/consult/$consultId`
- Confirm AI chat page loads
- Verify the contact details (name + email entered in step 6) were persisted via DB query

### Journey 2 — Authenticated patient
- Sign in with an existing test account (will need credentials from user OR I can sign up a fresh account)
- Navigate to `/consult`
- Verify Contact step pre-fills email from account
- Complete intake; confirm consult auto-claims to the user
- Check `/account` history shows the consult

### Journey 3 — Expert review
- Sign in as expert role user (need credentials)
- Navigate to `/expert`
- Verify queue loads with cards
- Confirm the consult from Journey 1 appears showing the captured contact name/email (the bug fix from prior turns)
- Open one prescription via `/expert/$prescriptionId` and verify editor loads

### Additional smoke checks
- Marketing routes load: `/`, `/origins`, `/philosophy`, `/pillars`, `/journey`, `/integrity`
- Auth routes render: `/login`, `/signup`, `/reset-password`
- Unauthorized route gates `/expert` for non-experts (currently the user is on `/unauthorized` — already a signal)

## Approach

1. **Smoke pass** — `navigate_to_sandbox` to each marketing + auth route, screenshot, check for console errors.
2. **Anonymous intake** — navigate to `/consult` signed-out, walk all 6 steps with `act`, capture the resulting consultId, query DB to confirm `intake.contactEmail` and `intake.contactName` saved.
3. **Expert journey** — needs an expert account. I'll ask for credentials before running this leg (or the user can confirm I should sign up + manually grant role).
4. **Authenticated patient journey** — same credential question; I can sign up a fresh test account inline if approved.

## Credentials I need

The expert and authenticated-patient legs need login credentials. Options:
- User provides email/password for an existing expert account
- I sign up a brand-new account in-flow for the patient leg, and skip the expert leg (or user grants role afterward)

I'll ask once, after approval, before starting the auth-gated legs. Anonymous + smoke can run immediately.

## Reporting

For each journey: PASS/FAIL, screenshots at key steps, any console errors, DB confirmation snippet for persistence checks. Final summary table at the end.

## Notes
- The user is currently on `/unauthorized` — they likely tried to access `/expert` without the role. Worth flagging in the report.
- Browser session is shared with the preview iframe; if a Supabase session leaks in, I'll sign out first to simulate "incognito".
- Will not perform destructive actions (no delete/reject on real prescriptions).
