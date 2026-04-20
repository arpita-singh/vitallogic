

User wants the CHANGELOG.md updated with recent work. Looking at what's shipped since the last `[Unreleased]` entry (dated 2026-04-20):

1. **Bootstrap admin migration** — granted admin to arpita.singh.syd@gmail.com + added unique constraint on `(user_id, role)`
2. **Security hardening** — explicit write policies on `user_purchases` (admin-only INSERT/UPDATE/DELETE); tightened `user_roles` INSERT policy with role-value check
3. **Role audit log** — new `role_audit_log` table + `SECURITY DEFINER` trigger on `user_roles` writes
4. **Admin audit dashboard** — new `/expert/admin/audit` route with six-track checks, role distribution, recent role changes, markdown export
5. **Architecture diagram** — `vital-logic-architecture.mmd` artifact
6. **Observability module** — KPIs, queue health, 14-day SVG sparkline, 30-day funnel, recent activity feed, active experts panel embedded in audit dashboard

## Plan

Append a new dated section under `[Unreleased]` in `CHANGELOG.md` covering these six items, grouped by track (🔒 Security / ✨ Features / 🐛 Bug Fixes), matching the existing format and tone. Also add a standalone `[Slice F] — 2026-04-20 · Admin observability & audit` heading below for parity with how Slice D and Slice E are documented.

### Structure of the new entry

Under `[Unreleased]`:
- 🔒 Security: bootstrap admin + unique constraint, `user_purchases` write lockdown, `user_roles` INSERT tightening, `role_audit_log` table + trigger
- ✨ Features: `/expert/admin/audit` dashboard, observability module (KPIs / sparkline / funnel / activity feed), markdown export, architecture diagram artifact

Plus a new `[Slice F] — 2026-04-20 · Admin observability & audit` block summarising the dashboard + observability work as a single vertical slice.

### Files touched
- Edit: `CHANGELOG.md` — insert new entries above existing `[Slice E]` block, extend `[Unreleased]` section

### Verification
1. Open `CHANGELOG.md` → new entries appear under `[Unreleased]` with correct date and emoji track headers
2. New `[Slice F]` block sits between `[Unreleased]` and `[Slice E]`
3. Format matches existing slices (heading style, bullet voice, three-track grouping)
4. No duplicate entries — items already in `[Unreleased]` from prior turns are preserved

