-- Defense-in-depth for user_roles: add a trigger that prevents any non-admin
-- authenticated user from inserting or updating a row, even if a future RLS
-- policy change accidentally weakened the WITH CHECK clause.
--
-- The service role bypasses RLS *and* triggers with SECURITY DEFINER context,
-- so seeding the first admin via the admin client (or SQL editor) still works.
-- Regular authenticated users go through this trigger and are blocked unless
-- they already have the admin role.

create or replace function public.guard_user_roles_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow when no auth context (service role / superuser path).
  if auth.uid() is null then
    return new;
  end if;

  -- Otherwise the caller must already be an admin.
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can assign roles'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end;
$$;

drop trigger if exists guard_user_roles_write on public.user_roles;

create trigger guard_user_roles_write
before insert or update on public.user_roles
for each row
execute function public.guard_user_roles_write();