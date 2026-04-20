# Changelog

All notable changes to VitalLogic are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased] — 2026-04-20

### Added
- Safety guardrails column (`safety_guardrails` JSONB) on `certified_materia_medica`
  with a functional index on `pregnancy_unsafe`.
- Auto safety filter in the `generate-prescription` edge function — parses intake
  for pregnancy, breastfeeding, under-18, hyperthyroid, autoimmune, and current
  medications, then excludes contraindicated products before the AI sees the
  catalog. Persists the audit trail under `draft.safety_filtered`.
- "Safety filter applied" disclosure block on the patient result page listing
  triggered flags and excluded products.
- "Auto safety filter" audit block in the expert review modal so practitioners
  can see what the system removed and why.
- Anonymous consult support — `anonToken` stored in `localStorage` lets visitors
  complete a consult without an account; the contact step captures email for
  practitioner follow-up.
- `consult-access` edge function consolidating `start`, `read`, `saveContact`,
  `claim`, and `unlock` actions behind a single authenticated entry point.

### Fixed
- Stale-session loop on `/consult/$id/result` — the auth client now revalidates
  the cached session against the auth server on init and signs out locally if
  the session has been revoked, replacing the infinite "claiming…" state with
  a proper sign-in gate.
- Toast spam from `claimSpecificConsult` on 401 responses.

### Changed
- Replaced `consult-server.ts` + `consult-schema.ts` with `consult-access.ts`
  + `consult-types.ts` — smaller surface, single source of truth for consult
  access rules shared between client and edge function.
