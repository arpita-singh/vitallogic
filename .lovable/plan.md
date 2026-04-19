

## Fix — `has_role_ignores_user_id_parameter`

### Background
In an earlier pass we hardened `has_role` against role enumeration by making the body always check `auth.uid()` and ignoring the `_user_id` argument. The scanner now (correctly) flags the opposite risk: the function lies about what it does. If a future RLS policy ever passes a non-caller uuid (e.g. to check whether a target resource's owner has a role), it will silently return the caller's role instead — a subtle, dangerous correctness bug.

### Fix
Make `has_role` honour its parameter again, but close the enumeration vector at the permission layer instead of inside the function body.

```sql
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role    = _role
  )
$$;

-- Lock down direct RPC access; RLS policies still call it fine because
-- SECURITY DEFINER runs as the function owner.
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
```

Why this is safe:
- All existing RLS policies pass `auth.uid()` (verified across the schema dump) → behaviour unchanged for legitimate access checks.
- `SECURITY DEFINER` means RLS evaluation continues to execute the function regardless of `EXECUTE` grants to the calling role — Postgres only checks `EXECUTE` for direct invocations (RPC / ad-hoc SQL), not for references inside policies executed by the planner.
- Revoking `EXECUTE` from `authenticated`/`anon`/`public` removes the PostgREST RPC enumeration surface entirely. A signed-in user calling `supabase.rpc('has_role', { _user_id: '<other>', _role: 'admin' })` now gets `permission denied for function has_role`.

### Files to change
- New migration: `supabase/migrations/<ts>_restore_has_role_param.sql`

### Verification
- App-side role checks (route guards, expert dashboard, RLS on every table) keep working — they all run through policies, not direct RPC.
- Direct RPC enumeration is rejected with `permission denied`.
- Scanner finding `has_role_ignores_user_id_parameter` clears.

### Side fix (runtime error in preview)
The current preview shows `Missing Supabase server environment variables` from `src/integrations/supabase/client.server.ts`. I'll add `import.meta.env` fallbacks (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) before throwing so SSR stops crashing in the Worker when `process.env` is empty. Small, contained; same pass.

### Out of scope (separate findings)
- `consult_messages` anonymous read/write hardening
- `user_purchases` owner UPDATE scope tightening

