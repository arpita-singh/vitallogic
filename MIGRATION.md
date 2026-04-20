# Vital Logic — Self-Hosting Migration Audit

A single checklist of every place this codebase is coupled to **Lovable Cloud**
(hosted Supabase + Lovable AI Gateway). Use it when forking the repo from
GitHub to run locally with self-hosted Postgres + Ollama / Anthropic Claude.

> **Source of truth split**
> - **In GitHub** (100% of source): every file in this repo — routes, components, edge functions in `supabase/functions/`, schema in `supabase/migrations/`, assets.
> - **NOT in GitHub** (lives in Lovable Cloud): row data, `auth.users`, secrets, deployed function runtime, the auto-generated `.env`, `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`.

---

## 1. AI provider coupling

The only two places that talk to an LLM are now routed through the shared
provider abstraction at `supabase/functions/_shared/llm.ts`. Switch providers
by setting environment variables on your local Supabase project — **no code
edits required**.

| Variable          | Values                              | Default      |
| ----------------- | ----------------------------------- | ------------ |
| `LLM_PROVIDER`    | `lovable` \| `ollama` \| `anthropic`| `lovable`    |
| `LLM_MODEL`       | provider-specific model name        | per-provider |
| `OLLAMA_BASE_URL` | e.g. `http://host.docker.internal:11434` | `http://localhost:11434` |
| `LOVABLE_API_KEY` | required when `LLM_PROVIDER=lovable`| (auto)       |
| `ANTHROPIC_API_KEY` | required when `LLM_PROVIDER=anthropic` | —         |

Files that use it:
- `supabase/functions/consult-chat/index.ts` — streaming SSE chat
- `supabase/functions/generate-prescription/index.ts` — tool-call JSON

---

## 2. Lovable-Cloud-coupled files

| File | Coupling | Action when self-hosting |
|------|----------|--------------------------|
| `.env` | auto-managed by Lovable, holds `VITE_SUPABASE_*` | replace with values from your local `supabase start` output |
| `src/integrations/supabase/client.ts` | reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` | works as-is once `.env` points to local Supabase |
| `src/integrations/supabase/types.ts` | regenerated from your DB | run `supabase gen types typescript --local > src/integrations/supabase/types.ts` |
| `src/integrations/supabase/client.server.ts` | server-side SSR client | works as-is |
| `src/integrations/lovable/index.ts` | calls Lovable OAuth helper | optional — replace with `supabase.auth.signInWithOAuth(...)` if you want to drop the Lovable dependency entirely |
| `supabase/config.toml` | per-function `verify_jwt` config | reuse with local Supabase CLI |
| `supabase/migrations/**` | full schema history | apply with `supabase db reset` |
| `supabase/functions/consult-chat/index.ts` | LLM call (now via `_shared/llm.ts`) | set `LLM_PROVIDER` env var |
| `supabase/functions/generate-prescription/index.ts` | LLM call (now via `_shared/llm.ts`) | set `LLM_PROVIDER` env var |
| `supabase/functions/marketplace-import/index.ts` | DB writes only | works as-is |
| `supabase/functions/consult-access/index.ts` | DB reads only | works as-is |

---

## 3. Runtime data NOT in the repo

You will need to migrate these out of Lovable Cloud separately:

- **All table rows**: Cloud → Database → export each table to CSV, then `\copy` into local Postgres.
- **`auth.users`**: export via the Supabase dashboard. Password hashes can be re-imported but require care; OAuth identities will need users to re-link.
- **Storage objects**: none configured in this project today — nothing to migrate.
- **Secrets**: re-create locally — `LOVABLE_API_KEY` (only if you keep using Lovable AI), `ANTHROPIC_API_KEY`, `OLLAMA_BASE_URL`, etc.
- **Edge function deployments**: deploy locally with `supabase functions serve`.

---

## 4. OAuth callbacks

Google sign-in callback URLs are configured against your hosted domain.
For local dev you must add `http://localhost:54321/auth/v1/callback` (the
Supabase CLI default) to the authorised redirect URIs in your Google OAuth app.

---

## 5. What you can drop entirely

If you fully self-host and stop using Lovable AI:

- The `LOVABLE_API_KEY` secret
- `src/integrations/lovable/index.ts` (replace with direct `supabase.auth.signInWithOAuth`)
- The per-function `verify_jwt` overrides for the AI functions if you change the auth model

See `README.local.md` for the step-by-step setup.
