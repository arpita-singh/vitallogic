

This is a research/advice question, not an implementation task. The user wants to understand:
1. What's on GitHub vs Lovable for their Vital Logic project
2. How to move it local and run it with Ollama + Claude

Let me give a direct, honest answer rather than a build plan.

## The split: GitHub vs Lovable

**100% of your code lives in GitHub** — once you've connected the GitHub integration, every file in this project (every `.tsx` route, edge function, migration, asset) is mirrored to your repo in real time. There is no "Lovable-only" code. The two-way sync means GitHub is a complete copy.

**What is NOT in GitHub** (lives in Lovable Cloud / Supabase, not your repo):
- **Database data** — every row in `consults`, `prescriptions`, `user_roles`, `role_audit_log`, `user_purchases`, `profiles`, etc. (schema is in `supabase/migrations/`, but the *data* isn't)
- **Auth users** — the `auth.users` table (emails, password hashes, OAuth links)
- **Storage objects** — any uploaded files in storage buckets
- **Secrets** — `LOVABLE_API_KEY`, any other env secrets configured in Cloud
- **Deployed edge function runtime** — source is in `supabase/functions/`, but the running deployment is on Supabase's edge
- **Lovable-managed config** — `.env`, `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts` (auto-generated, not committed in the usual way)

So the rough split is: **~100% of source code in GitHub, ~0% Lovable-exclusive code**, but **runtime state (DB rows, users, secrets) lives in Lovable Cloud**.

## Moving local + Ollama + Claude — the honest assessment

What works straightforwardly:
- **Clone from GitHub, run Vite locally** — `bun install && bun dev` will boot the frontend
- **Point at a self-hosted Supabase** (Docker) for DB + auth + storage — you'd export your current schema (already in `supabase/migrations/`) and re-apply, then export data via Cloud → Database → export CSV
- **Replace Lovable AI Gateway with Ollama or Claude** — your only AI integration today is in `supabase/functions/consult-chat/index.ts` and `supabase/functions/generate-prescription/index.ts`, both of which call `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`. Swap the URL + auth header for either:
  - **Ollama**: `http://localhost:11434/v1/chat/completions` (OpenAI-compatible, no key) — model name like `llama3.1` or `qwen2.5`
  - **Claude (Anthropic)**: `https://api.anthropic.com/v1/messages` — different request/response shape, needs a small adapter, plus `ANTHROPIC_API_KEY`

What's harder:
- **Edge function runtime** — Supabase edge functions are Deno; running them locally needs the Supabase CLI (`supabase start` + `supabase functions serve`). Workable but a setup step.
- **Auth** — Google OAuth callback URLs are tied to your hosted domain; you'd reconfigure the OAuth app for `http://localhost:54321/auth/v1/callback`.
- **Data migration** — you have to manually export each table's CSV from Cloud and `\copy` into local Postgres. The `auth.users` table is trickier (password hashes are exportable but require care).
- **Streaming** — Ollama's OpenAI-compatible streaming works; Claude's native streaming uses a different SSE shape (your `consult-chat` SSE parser would need a small fork for Claude).

## What I'd build for you (when you approve)

A short, honest migration plan rather than code edits:

1. **Repo audit doc** — generate `MIGRATION.md` listing every Lovable-Cloud-coupled touchpoint (each `supabase/functions/*`, every table referenced in code, every `LOVABLE_*` env var) so you have a single checklist.
2. **AI provider abstraction** — refactor `consult-chat` and `generate-prescription` to call a shared `callLLM({ provider, model, messages, stream })` helper that supports `lovable | ollama | anthropic`, switched by an env var. Default stays `lovable` so your hosted app keeps working; locally you flip to `ollama` or `anthropic`.
3. **Local-dev README** — step-by-step: clone, `supabase init` + `supabase start`, apply migrations, env file template (`OLLAMA_BASE_URL`, `ANTHROPIC_API_KEY`, etc.), data import notes.
4. **Optional: Docker compose** — one-shot bring-up (Postgres + Supabase services + Ollama container) so a fresh machine boots in one command.

None of this disconnects you from Lovable — your hosted app keeps working while you also have a fully local fork. You can disable Lovable Cloud entirely later if you want to fully self-host (note: Cloud cannot be re-disabled inside Lovable for *future projects* in the same workspace — see Connectors → Lovable Cloud).

### Files I'd touch
- New: `MIGRATION.md` (root)
- New: `README.local.md` (local-dev guide)
- Edit: `supabase/functions/consult-chat/index.ts` (provider switch)
- Edit: `supabase/functions/generate-prescription/index.ts` (provider switch)
- New: `supabase/functions/_shared/llm.ts` (provider abstraction)
- Optional: `docker-compose.local.yml`

### Verification (after you approve and I implement)
1. Hosted app still uses Lovable AI by default and works unchanged
2. Setting `LLM_PROVIDER=ollama` + `OLLAMA_BASE_URL=http://host.docker.internal:11434` routes consult-chat to local Ollama
3. Setting `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY=...` routes to Claude with streaming working
4. `MIGRATION.md` lists every Cloud-coupled file with a one-line action for each
5. Following `README.local.md` on a clean machine boots the full stack

