

## Goal
Document the recent VitalLogic changes (anonymous consult flow, stale-session fix, Slice B safety guardrails) so they're visible on GitHub.

## Option 1 — Add a CHANGELOG.md in the repo (Lovable does this)
Create `CHANGELOG.md` at the project root following the **Keep a Changelog** convention. Seed it with one `## [Unreleased]` section covering what's shipped since the last quiet point:

```
## [Unreleased] — 2026-04-20

### Added
- Safety guardrails column (`safety_guardrails` JSONB) on `certified_materia_medica`
- Auto safety filter in `generate-prescription` (pregnancy, breastfeeding, under-18,
  hyperthyroid, autoimmune, drug-interaction matching against intake)
- "Safety filter applied" disclosure on the patient result page
- "Auto safety filter" audit block in the expert review modal
- Anonymous consult support with `anonToken` stored in localStorage
- `consult-access` edge function consolidating start/read/saveContact/claim/unlock

### Fixed
- Stale-session loop on `/consult/$id/result` — client now revalidates the cached
  session against the auth server on init and signs out locally if revoked
- Toast spam from `claimSpecificConsult` on 401 responses

### Changed
- Replaced `consult-server.ts` + `consult-schema.ts` with `consult-access.ts`
  + `consult-types.ts` (smaller surface, single source of truth)
```

I'll also add a short note at the top of `README.md` linking to it ("See `CHANGELOG.md` for release notes").

After Lovable writes these files, the GitHub sync pushes them automatically. They'll be visible on your repo's homepage within seconds.

## Option 2 — Cut a real GitHub Release (you do this, ~30 seconds)
Lovable can't do this part, but it's quick:

1. On GitHub, open your repo → **Releases** (right sidebar) → **Draft a new release**.
2. **Choose a tag** → type `v0.2.0` (or whatever version) → "Create new tag on publish".
3. **Release title**: `v0.2.0 — Safety guardrails & stale-session fix`
4. Click **Generate release notes** (GitHub auto-fills from commits since the last release), or paste the `## [Unreleased]` section from the CHANGELOG.
5. **Publish release**.

This is the canonical "release notes" surface on GitHub and shows up under your repo's Releases tab, RSS feed, and the sidebar.

## Recommendation
Do **both**: let me create `CHANGELOG.md` now (Option 1) so the notes live in the repo as the source of truth, then you copy that section into a GitHub Release (Option 2) when you want a tagged milestone. The CHANGELOG also makes future releases trivial — you just promote `[Unreleased]` to a new version heading.

## Files I'd touch (Option 1 only)
- Create `CHANGELOG.md` (new, ~40 lines)
- Edit `README.md` — add a one-line "See CHANGELOG.md for release notes" near the top

## Out of scope
- Creating git tags or GitHub Releases from inside Lovable (not supported by the integration)
- Auto-generating notes from commit history (would need a CI workflow like `release-please` — happy to set that up as a follow-up if you want it automated)

