# Running Vital Logic locally (self-hosted)

This guide walks you from a fresh clone to a fully local Vital Logic stack:
local Postgres + Supabase services + your choice of Ollama or Anthropic Claude
for the AI. Use it alongside [`MIGRATION.md`](./MIGRATION.md), which audits
every Cloud-coupled file.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Docker Desktop](https://docs.docker.com/get-docker/) (for the Supabase CLI)
- [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 1.180
- One of:
  - [Ollama](https://ollama.com) installed and running locally, OR
  - An [Anthropic API key](https://console.anthropic.com)

## 1. Clone and install

```bash
git clone <your-fork-url> vital-logic
cd vital-logic
bun install
```

## 2. Start local Supabase

```bash
supabase init     # only the first time
supabase start
```

The CLI prints values you'll need — copy them into a new `.env`:

```bash
# .env  (replace with values from `supabase status`)
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon key from supabase status>"
VITE_SUPABASE_PROJECT_ID="local"
```

## 3. Apply schema + regenerate types

```bash
supabase db reset                                                    # applies all migrations
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## 4. Configure the AI provider

Pick **one** of the three. Set these as Supabase function secrets so the edge
functions pick them up:

### Option A — Ollama (free, local)

```bash
ollama pull llama3.1
supabase secrets set LLM_PROVIDER=ollama
supabase secrets set OLLAMA_BASE_URL=http://host.docker.internal:11434
supabase secrets set LLM_MODEL=llama3.1   # optional override
```

### Option B — Anthropic Claude

```bash
supabase secrets set LLM_PROVIDER=anthropic
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set LLM_MODEL=claude-3-5-sonnet-latest   # optional override
```

### Option C — Keep using Lovable AI

```bash
supabase secrets set LLM_PROVIDER=lovable
supabase secrets set LOVABLE_API_KEY=<your key>
```

## 5. Serve edge functions

```bash
supabase functions serve --env-file ./supabase/.env.local
```

(Where `./supabase/.env.local` mirrors the secrets above for local serve.)

## 6. Run the frontend

```bash
bun dev
```

Open `http://localhost:3000` — you're now talking to local Postgres + your
chosen LLM with zero Lovable Cloud dependency.

## 7. (Optional) Migrate your real data

From Lovable: **Cloud → Database → Tables**, export each table to CSV.

Then load locally:

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" \
  -c "\copy public.consults FROM 'consults.csv' CSV HEADER"
# repeat for each table
```

The `auth.users` table is trickier — see Supabase's
[user migration guide](https://supabase.com/docs/guides/auth/auth-migrations).

## 8. Google OAuth (optional)

Add `http://127.0.0.1:54321/auth/v1/callback` to your Google OAuth app's
authorised redirect URIs, then in `supabase/config.toml` enable the Google
provider with your client ID / secret.

---

## Switching providers later

Everything LLM-related is centralised in `supabase/functions/_shared/llm.ts`.
To switch from Ollama to Claude (or back), change `LLM_PROVIDER` and restart
`supabase functions serve` — no code edits needed.

## Troubleshooting

- **`LOVABLE_API_KEY not configured`** — you're on `LLM_PROVIDER=lovable` without a key. Either set the key or switch provider.
- **Ollama connection refused from edge function** — Docker can't reach `localhost`. Use `http://host.docker.internal:11434` (already the default in step 4A).
- **OAuth callback error** — check the redirect URI is registered in the Google Cloud Console exactly, including the port.
