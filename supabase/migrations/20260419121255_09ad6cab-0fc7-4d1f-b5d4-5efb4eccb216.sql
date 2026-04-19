-- Harden has_role: ignore the _user_id argument and always check the caller.
-- Keeps the existing signature so RLS policies and generated types stay unchanged.
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
    where user_id = auth.uid()
      and role    = _role
  )
$$;

-- Lock down direct RPC access: only authenticated callers may invoke it.
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;