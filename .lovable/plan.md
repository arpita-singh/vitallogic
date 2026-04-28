## Goal
Route all future Lovable auto-commits to the `lovableAI` branch on `arpita-singh/vitallogic` instead of `main`, so your hand-written `main` is never overwritten by Lovable.

## The constraint
Lovable's GitHub sync is **one-way push to a single configured branch** (currently `main`). I have no tool to change that target — only you can, via the Labs flag + project setting. Until you do this, every edit I make will keep landing on `main`.

## What you need to do (one-time, ~2 minutes)

### Step 1 — Enable the Labs flag
1. Top-right avatar → **Account Settings** → **Labs**
2. Toggle on **"GitHub Branch Switching"**

### Step 2 — Point Lovable at `lovableAI`
1. Project name (top-left) → **Settings** → **GitHub** tab
2. In the branch selector, choose **`lovableAI`**
3. Confirm — Lovable will now push all future commits there

### Step 3 — Confirm `lovableAI` already exists on GitHub
Your link shows it does: `github.com/arpita-singh/vitallogic/tree/lovableAI` ✓
(If Lovable says the branch isn't found, create it from `main` on GitHub first: branch dropdown → type `lovableAI` → "Create branch from main".)

### Step 4 — Tell me when done
Reply "done" and I'll make a tiny no-op commit (e.g. a comment in `.lovable/plan.md`) so you can verify in GitHub that the next push lands on `lovableAI`, not `main`.

## What this gives you
- `main` = your hand-written code, untouched by Lovable
- `lovableAI` = Lovable's working branch, auto-updated on every edit
- You control merges from `lovableAI` → `main` via PRs on GitHub, reviewing every diff

## What I cannot do
- Run `git pull`, `git diff`, `git checkout`, or `git push`
- Create branches on your GitHub remote
- Change the sync branch setting
- See what's currently diverged between Lovable's state and your local `main`

## After switching: recommended workflow
1. Lovable pushes to `lovableAI` automatically
2. On GitHub, open a PR `lovableAI` → `main` whenever you want to review
3. Merge selectively; reject anything that conflicts with your local logic
4. If `main` drifts ahead of `lovableAI`, periodically merge `main` → `lovableAI` so Lovable stays in sync with your edits

## Optional cleanup before switching
The throwaway script `tmp_export_users.mjs` from the user-export task is still in the repo root. Want me to delete it before the next sync so it doesn't propagate to `lovableAI`? (Yes/no in your reply.)

<!-- branch-sync verification ping: 2026-04-28 — if this commit appears on lovableAI (not main), the default-branch swap worked. -->
