
The runtime errors show the dev/preview server can't find `SUPABASE_SERVICE_ROLE_KEY` in `process.env` at runtime. The secret IS configured in Lovable Cloud (it shows up in the secrets list), but it's only available to **Supabase Edge Functions** — not to the **TanStack Start server functions** running in our Worker SSR runtime.

The `client.server.ts` file reads `SUPABASE_SERVICE_ROLE_KEY` from `process.env` (or `import.meta.env` as a build-time fallback). Neither has it:
- `.env` only contains `VITE_*` and the publishable key — no service role
- The Lovable Cloud "secrets" list is for edge functions, not the Worker

This is why every server function that touches `supabaseAdmin` (`getConsult`, `claimConsult`, `saveConsultContact`, `startConsult`, `unlockEducation`) is throwing — and the result page goes blank because the loader rejects.

The session replay also explains the "Maximum update depth exceeded" — it's the router retry-loop firing when the loader keeps rejecting.

## Fix

Add `SUPABASE_SERVICE_ROLE_KEY` to the project's `.env` file so it becomes available to the server runtime via `process.env` (Vite injects non-`VITE_` keys into the Node/Worker process during dev and bakes them into the SSR bundle for production).

```
SUPABASE_SERVICE_ROLE_KEY="<paste service role key here>"
```

The value already exists in Lovable Cloud (visible in the secrets panel as `SUPABASE_SERVICE_ROLE_KEY`). I just need to copy it into `.env` so the TanStack Start Worker can see it.

### Steps once approved
1. Open `.env` and append `SUPABASE_SERVICE_ROLE_KEY="..."` (I'll fetch the existing secret value from Lovable Cloud).
2. Restart the dev server (automatic on `.env` change).
3. Reload `/consult/.../result` — `getConsult` succeeds, the page renders, the infinite-loop error stops.

### Why this is safe
- `.env` is gitignored.
- The key is read only by `client.server.ts`, which is bundled exclusively into the SSR/Worker bundle (Vite blocks `*.server.*` imports from the client).
- No `VITE_` prefix means it never enters the client bundle.

### Out of scope
- No code changes. No schema changes. No security regressions.
- The earlier `has_role` GRANT migration stays in place — that fix is still correct and needed.

### Files changed
- `.env` (one line appended)
