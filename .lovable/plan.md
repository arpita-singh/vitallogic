

User wants an architectural diagram of the Vital Logic system alongside the IDA work. Given they're on the plan view and just said "also need an architectural diagram", they want this added to the deliverables.

Best format: a Mermaid diagram (renderable, version-controllable, fits the technical audience). Save to `/mnt/documents/` as `.mmd` and emit as artifact.

## Architectural diagram + IDA dashboard

### Deliverable 1 — System architecture diagram (Mermaid)
A single `.mmd` file rendered as a downloadable artifact, covering:

- **Client layer**: Patient browser, Expert browser, Admin browser
- **Routing layer**: TanStack Start (public, `_authenticated`, `_expert`, `_expert/admin` route groups)
- **Server functions**: `consult-server` (claim, contact), `claim-consult`, `consult-access`
- **Edge functions**: `consult-chat`, `generate-prescription`, `marketplace-import`, `consult-access`
- **External services**: Lovable AI Gateway (Gemini/GPT), TGA verify URL, vendor storefronts (proxy fulfilment)
- **Database**: `profiles`, `user_roles`, `consults`, `prescriptions`, `prescription_audit`, `products`, `wisdom_protocols`, `user_purchases`
- **Security boundary**: RLS policies, `has_role()` SECURITY DEFINER, `guard_user_roles_write` trigger
- **Auth**: Supabase Auth (email + Google OAuth), session refresh on role grant

Color-coded by trust zone (public / authenticated / expert / admin / service-role) so you can see at a glance where the privilege boundaries are.

### Deliverable 2 — IDA Slice 1 + 2 (from previous plan)
Unchanged from prior turn:
- New migration: `role_audit_log` table + trigger on `user_roles` writes
- New route: `src/routes/_authenticated/_expert/expert_.admin.audit.tsx` with:
  - RLS coverage matrix (read-only checks)
  - Claim-language scan results
  - Role distribution + recent role changes from audit log
  - Pass/warn/fail dashboard
- Edit: `src/routes/_authenticated/_expert/expert.tsx` — add "Admin · Audit" nav link
- Markdown export of the dashboard

### Files touched
- New: `/mnt/documents/vital-logic-architecture.mmd` (diagram artifact)
- New migration: `role_audit_log` + trigger
- New: `src/routes/_authenticated/_expert/expert_.admin.audit.tsx`
- Edit: `src/routes/_authenticated/_expert/expert.tsx`

### Verification
1. Architecture diagram renders cleanly in the artifact preview, all trust zones visible and labelled
2. As admin → `/expert/admin/audit` loads dashboard with checks across all six tracks
3. Grant a role from `/expert/admin/roles` → entry appears in audit log on the audit page
4. Markdown export downloads and is human-readable
5. As expert (non-admin) → audit page shows "Admins only" guard

