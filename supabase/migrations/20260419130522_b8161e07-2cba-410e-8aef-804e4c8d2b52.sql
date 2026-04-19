-- Replace the admin UPDATE policy with one that has an explicit WITH CHECK
-- clause. This ensures any UPDATE done under the policy:
--   1. Is performed by an admin (USING)
--   2. Results in a row that is still owned by the same user_id and whose
--      role is a valid app_role enum value (WITH CHECK)
-- The enum already constrains role values at the type level, but stating it
-- in the policy makes the security intent explicit and closes the scanner
-- finding about a missing WITH CHECK on the admin update path.

drop policy if exists "Roles: admins can update" on public.user_roles;

create policy "Roles: admins can update"
on public.user_roles
for update
to public
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and role in ('user'::public.app_role, 'expert'::public.app_role, 'admin'::public.app_role)
);