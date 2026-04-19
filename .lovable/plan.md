

The scanner is flagging `has_role` again, but per the schema dump in context the function body **already** uses `_user_id` correctly:

```sql
select exists (
  select 1 from public.user_roles
  where user_id = _user_id
    and role    = _role
)
```

So the underlying bug is fixed — this is a stale finding from the scanner's previous snapshot. The previous pass also revoked direct RPC `EXECUTE` from `public/anon/authenticated`, closing the enumeration path while letting RLS policies (SECURITY DEFINER) keep working.

## What to do

**1. Mark the finding as fixed** in the scanner with an explanation pointing at the current function definition + the revoked grants. No code or DB changes needed for the security finding itself.

**2. Side-fix the runtime error blocking the preview**

`src/integrations/supabase/client.server.ts` is throwing `Missing Supabase server environment variables. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.` This breaks SSR pages right now. The Worker's `process.env` shim is empty in some code paths; add an `import.meta.env` fallback before throwing so server functions can read the values that are present at build time as well.

I'll inspect `client.server.ts` in the implementation pass and add the fallback chain:
```ts
const SUPABASE_URL = process.env.SUPABASE_URL ?? import.meta.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
```
Only the URL gets the `VITE_` fallback (it's public). The service-role key never falls back to a `VITE_` value — that would leak it to the client bundle.

## Files touched
- `src/integrations/supabase/client.server.ts` — env fallback chain
- Scanner: `mark_as_fixed` for `has_role_ignores_user_id_parameter`

## Out of scope (separate findings)
- `consults_anon_token_no_select_policy` (warn) — anonymous read of own consult/messages via token; tackle next pass.
- `consult_messages` anonymous insert hardening.
- `user_purchases` owner UPDATE column scope.

