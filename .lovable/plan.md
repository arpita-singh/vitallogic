

## Fix — `prescriptions_realtime_rls`

### Context
In the previous pass we already removed `prescriptions` from the `supabase_realtime` publication to close `prescriptions_realtime_no_rls_channel_auth`. The scanner is now flagging a related-but-distinct concern: even if Realtime were re-enabled, row-level filtering would not be guaranteed without (a) the table being in the publication with `REPLICA IDENTITY FULL`, and (b) SELECT RLS policies that correctly scope rows per subscriber.

Let me verify the current state before deciding.

### Verification step (during implementation)
Run a read-only check via `supabase--read_query`:
```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'prescriptions';
```
- **If the row is absent** (expected) → `prescriptions` is not broadcast at all. Mark the finding as fixed with that explanation. No DB change needed.
- **If the row is present** → drop it from the publication (the app fetches on demand; no UX regression):
  ```sql
  alter publication supabase_realtime drop table public.prescriptions;
  ```

Either way, the existing `prescriptions` SELECT policies are already correctly scoped per subscriber:
- `Prescriptions: owner sees approved` — owner only sees their own row, only when `status = 'approved'`.
- `Prescriptions: experts can select all` — gated by `has_role`.

So if Realtime is ever re-enabled in the future, row-level filtering will already be enforced (Supabase Realtime runs SELECT RLS as the subscriber for `postgres_changes`).

### Fix the runtime error blocking preview
Console shows `Missing Supabase server environment variables...` again. The Proxy fallback I added before still throws when none of `process.env.SUPABASE_URL` / `import.meta.env.SUPABASE_URL` / `import.meta.env.VITE_SUPABASE_URL` are set at the moment `supabaseAdmin` is first touched. I'll re-inspect `client.server.ts` and:
- Confirm the env-var names actually exposed to the Worker bundle (Vite only inlines `VITE_*` by default; bare `SUPABASE_URL` from `import.meta.env` won't be replaced unless explicitly defined).
- Use `VITE_SUPABASE_URL` (already in `.env`) as the primary source for the URL fallback.
- For `SUPABASE_SERVICE_ROLE_KEY`, keep `process.env` only (never expose to client). If it's genuinely missing in the Worker runtime, the lazy throw is correct behaviour — but I'll add the missing-var name to the error so we know which one is empty.

### Files
- `src/integrations/supabase/client.server.ts` — tighten env fallback + clearer error.
- (Conditional) new migration if `prescriptions` is still in `supabase_realtime`.
- Scanner: `mark_as_fixed` for `prescriptions_realtime_rls` with the verification result.

### Out of scope
- `user_purchases_owner_insert_no_update_check` (separate finding — needs server-side purchase write path).
- `intake_no_length_limits` (separate finding — needs zod input schemas).

