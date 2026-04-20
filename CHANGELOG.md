# Changelog — VitalLogic

A journey log of building **VitalLogic** with Lovable AI.
Format inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/).

## Overview

VitalLogic is an ARTG-aware natural-medicine consult platform: patients complete a guided intake, an AI drafts a prescription grounded in a curated wisdom base + certified materia medica, and a human expert reviews and approves it before the patient sees the result. The product was built iteratively in **slices** — each slice ships one vertical thread end-to-end (schema → server → UI → safety) before moving to the next.

Each release below is grouped into three tracks:
- 🔒 **Security** — RLS, role guards, validation, contraindication filtering, session/auth handling
- ✨ **Features** — user-facing capabilities
- 🐛 **Bug Fixes** — defects resolved

---

## [Unreleased] — 2026-04-20

### 🔒 Security
- **Bootstrap admin migration** — granted `admin` role to `arpita.singh.syd@gmail.com` and added a unique constraint on `user_roles(user_id, role)` to prevent duplicate role grants.
- **`user_purchases` write lockdown** — explicit admin-only `INSERT` / `UPDATE` / `DELETE` policies; users can read their own row but cannot self-grant unlocked education or fabricate purchases.
- **`user_roles` INSERT tightening** — policy now validates the inserted role value against the `app_role` enum at the policy level, blocking any client-side privilege-escalation attempt that bypasses the security-definer path.
- **`role_audit_log` table** + `SECURITY DEFINER` trigger on `user_roles` writes — every grant/revoke is recorded with actor, target, role, and timestamp. Admins-only read policy; rows are immutable from the client.
- `consult-access` edge function consolidates `start`, `read`, `saveContact`, `claim`, and `unlock` actions behind a single authenticated entry point — smaller surface, single source of truth for consult access rules.
- Auto safety filter parses intake for **pregnancy, breastfeeding, under-18, hyperthyroid, autoimmune, and current medications**, then excludes contraindicated products *before* the AI sees the catalog. Audit trail persisted under `draft.safety_filtered`.
- New `safety_guardrails` JSONB column on `certified_materia_medica` with a functional index on `pregnancy_unsafe`.

### ✨ Features
- **Admin audit dashboard** at `/expert/admin/audit` — six-track readiness checks (Auth, RLS, Roles, Consult, Prescription, Marketplace), role distribution panel, recent role-change feed, and Markdown export for offline review.
- **Observability module** embedded in the audit dashboard — 7-day KPI tiles (consults, prescriptions, approvals, median review time), queue health with colour-coded oldest-pending age, hand-rolled 14-day SVG sparkline (consults vs approvals), 30-day conversion funnel with drop-off %, active-experts panel, and a unified recent activity feed across consults, prescriptions, and role changes.
- **Architecture diagram** — `vital-logic-architecture.mmd` Mermaid artifact mapping trust zones, data flow, edge functions, and external dependencies.
- **Slice E — Marketplace expansion (Isha Life AU):** second Shopify source wired through a `MARKETPLACE_SOURCES` config map. Isha Life products land tagged `source_authority: consecrated` while Healthy Habitat stays `clinical`. Catalog UI gets a per-source filter chip.
- **Slice D — Fulfillment Linker v1 (Healthy Habitat Market):** Shopify `/products.json` ingestion, expert catalog review UI, price/stock re-sync, dedupe per `(import_source, import_external_id)`.
- **Anonymous consult support** — `anonToken` in `localStorage` lets visitors complete a consult without an account; the contact step captures email for practitioner follow-up.
- **"Safety filter applied"** disclosure on the patient result page listing triggered flags + excluded products.
- **"Auto safety filter"** audit block in the expert review modal.

### 🐛 Bug Fixes
- Stale-session loop on `/consult/$id/result` — the auth client now revalidates the cached session against the auth server on init and signs out locally if the session has been revoked, replacing the infinite "claiming…" state with a proper sign-in gate.
- Toast spam from `claimSpecificConsult` on 401 responses.

### 🔄 Changed
- Replaced `consult-server.ts` + `consult-schema.ts` with `consult-access.ts` + `consult-types.ts`.

---

## [Slice F] — 2026-04-20 · Admin observability & audit

### ✨ Features
- New `/expert/admin/audit` route — admin-only dashboard surfacing system readiness across six tracks (Auth, RLS, Roles, Consult, Prescription, Marketplace).
- Role distribution panel + recent role-change feed sourced from `role_audit_log`.
- **Observability panel** — 7-day KPI tiles, queue health (pending / unclaimed / escalated, oldest-pending age with green/amber/red banding), 14-day inline SVG sparkline (consults vs approved prescriptions), 30-day conversion funnel with drop-off %, active-experts table, unified 20-event activity feed.
- Markdown export captures the full snapshot (checks + KPIs + funnel) for offline review.
- Architecture artifact: `vital-logic-architecture.mmd` (Mermaid) covering trust zones, edge functions, data flow, and external services.

### 🔒 Security
- Admin-only route guard via existing `_expert` layout + `has_role(_user_id, 'admin')` check inside the page.
- New `role_audit_log` table with RLS (admins read; trigger writes via `SECURITY DEFINER`); `user_roles` writes now logged automatically.
- Hardened `user_purchases` (admin-only writes) and `user_roles` INSERT policy (validates against `app_role` enum).
- Bootstrap migration: granted `admin` to `arpita.singh.syd@gmail.com` + unique constraint on `user_roles(user_id, role)`.

---

## [Slice E] — 2026-04-20 · Marketplace expansion

### ✨ Features
- Added **Isha Life AU** as a second marketplace source alongside Healthy Habitat Market.
- Extracted `MARKETPLACE_SOURCES` config map — parameterised the import function instead of hardcoding URLs.
- Per-source `defaultSourceAuthority` baked into the config (`consecrated` for Isha Life, `clinical` for Healthy Habitat).
- Catalog UI: side-by-side import buttons + filter chip (`all` / `healthy_habitat` / `isha_life`) above the pending-review table.

---

## [Slice D] — 2026-04-19 · Fulfillment Linker v1

### ✨ Features
- Shopify `/products.json` ingestion pipeline against `healthyhabitatmarket.com`.
- `certified_materia_medica` extended with `import_source`, `import_external_id`, `import_status`, `vendor_name`, `external_url`, `stock_status`, `artg_verified`, `aust_l_number`.
- Expert catalog route `/expert/catalog` for reviewing imported SKUs (approve / reject / edit metadata).
- Price/stock re-sync on re-import without clobbering expert curation.

### 🔒 Security
- **`pending_review` staging gate** — only `live` rows are queryable for prescription drafts. Unverified SKUs cannot leak into patient-facing recommendations.
- RLS: experts/admins can read/write all rows; patients can only read `live`.

---

## [Slice C+] — 2026-04-19 · Wisdom ingestion (Anand Yoga)

### ✨ Features
- Seeded `wisdom_sources` and `wisdom_protocols` with the Anand Yoga corpus (practices, indications, contraindications, expected outcomes).
- Prescription drafts can attach protocols alongside products.
- Snapshot timestamps so attached protocols are immutable once a prescription is approved.

---

## [Safety Filter Slice] — 2026-04-19

### 🔒 Security
- Intake parser detects: pregnancy, breastfeeding, under-18, hyperthyroid, autoimmune, current medications.
- Contraindicated products excluded from the AI's candidate set *before* generation — defense in depth, not a post-filter.
- Full audit trail persisted on the prescription draft.

### ✨ Features
- Patient result page surfaces a "Safety filter applied" disclosure block listing triggered flags + excluded SKUs.
- Expert review modal shows an "Auto safety filter" audit block so practitioners see exactly what was removed and why.

---

## [Anonymous Consult Slice] — 2026-04-19

### ✨ Features
- `anonToken` stored in `localStorage` lets unauthenticated visitors complete a full consult.
- Contact-capture step on the consult flow captures email for follow-up.
- **Claim-on-signup** — when an anon user signs up, their existing consult + prescription transfer to their account.

### 🔒 Security
- Consolidated all consult access through the `consult-access` edge function (single entry point, single auth check).
- `anon_token_hash` stored hashed; raw token never persisted server-side.

### 🐛 Bug Fixes
- Stale-session loop on `/consult/$id/result` resolved via session revalidation on auth client init.
- `claimSpecificConsult` no longer spams toasts on 401 responses.

---

## [Expert Workspace Slice] — 2026-04-19

### ✨ Features
- `/expert` queue with prescription cards (claim / review / escalate).
- **Prescription review modal** — side-by-side draft vs final, recommendation editor, product picker, wisdom picker, audit trail.
- `prescription_audit` table records every action (claim, edit, approve, reject, escalate) with diff.

### 🔒 Security
- `_expert` route guard — server-side role check before rendering anything.
- `app_role` enum (`user` / `expert` / `admin`) stored in a separate `user_roles` table.
- `has_role(_user_id, _role)` security-definer function used in all RLS policies — prevents recursive RLS issues and privilege escalation via profile updates.

---

## [Consult Engine Slice] — 2026-04-19

### ✨ Features
- Multi-step intake stepper with chat-style follow-up questions.
- `consult-chat` edge function (Lovable AI Gateway, Gemini 2.5 Flash) for adaptive intake.
- `generate-prescription` edge function drafts a structured prescription from intake + wisdom base + materia medica.
- Modality badges and protocol/product cards on the result page.

### 🔒 Security
- RLS on `consults` and `consult_messages` enforcing per-user isolation; anon access scoped by hashed token.
- Edge functions verify both authenticated JWTs and anon tokens through a unified middleware.

---

## [Auth Foundation Slice] — 2026-04-19

### ✨ Features
- Email + password signup/login, password reset flow, `/account` page.
- Google OAuth signup/login.
- `auth.callback` route to handle OAuth + magic-link returns.

### 🔒 Security
- Roles stored in a **separate `user_roles` table** — never on `profiles` (no privilege escalation via profile update).
- RLS policies on `profiles`, `user_roles`, `user_purchases`.
- Auto-create `profiles` row on signup via trigger.
- Email verification required before sign-in (no auto-confirm).

---

## [Marketing Site Slice] — 2026-04-19

### ✨ Features
- Site shell — `site-header`, `site-footer`, shared `<Section>` primitive.
- Content routes: `/philosophy`, `/origins`, `/journey`, `/pillars`, `/integrity`, `/owner-manual`.
- Per-route SEO metadata (title, description, OG tags).

---

## [Project Bootstrap] — 2026-04-19

### ✨ Features
- TanStack Start v1 + React 19 + Vite 7 + Tailwind v4.
- shadcn/ui component library wired through semantic design tokens in `src/styles.css`.
- Lovable Cloud (Supabase) provisioned with typed client.

### 🔒 Security
- RLS-first defaults — every table created with RLS enabled before any policy is written.
- `.env` and Supabase types/client managed by Lovable; never hand-edited.

---

*Built iteratively with Lovable AI — one vertical slice at a time, schema → server → UI → safety.*
