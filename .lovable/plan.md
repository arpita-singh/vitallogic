

## Fix — `user_roles_self_escalation`

### Root cause
`public.has_role(_user_id uuid, _role app_role)` is `SECURITY DEFINER` and accepts any `_user_id`. Although every RLS policy in this project currently passes `auth.uid()`, the function is still callable by any authenticated user via PostgREST RPC with an arbitrary uuid, letting them probe other users' roles. The scanner is flagging that the function does not enforce caller identity internally.

### Fix
Harden `has_role` so it only ever checks the calling user, regardless of what `_user_id` is passed. This neutralises the enumeration vector while remaining 100% backwards compatible with every existing RLS policy (all of them already pass `auth.uid()`).

Two safe options — I'll do option A because it preserves the existing function signature and avoids touching policies/types:

**Option A (chosen): keep the signature, ignore the argument internally**

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
    where user_id = auth.uid()      -- always the caller
      and role    = _role
  )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
```

Notes:
- `_user_id` becomes a no-op kept only for signature compatibility with existing policies and the generated TS types.
- `revoke ... from anon` removes the unauthenticated probe surface. `authenticated` keeps RLS working.
- No application code change required. No `types.ts` change required.

### Files to change
- New migration: `supabase/migrations/<timestamp>_harden_has_role.sql`

### Verification
- Existing RLS policies (all using `has_role(auth.uid(), ...)`) keep working unchanged.
- A logged-in user calling `supabase.rpc('has_role', { _user_id: '<other-uuid>', _role: 'admin' })` now returns the result for *themselves*, not the targeted user — enumeration is closed.
- Anonymous calls are rejected by the new `revoke from anon`.

### Out of scope
The other open findings (`anon_consult_exposure`, `prescriptions_realtime_broadcast`, `consult_messages_anonymous_insert`, `edge_fn_idor`) are tracked separately and can be addressed in their own passes.

