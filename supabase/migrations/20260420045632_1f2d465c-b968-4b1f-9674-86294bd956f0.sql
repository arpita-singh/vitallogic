-- Migration 1: Lock down user_purchases writes (admins only; service role bypasses RLS)
create policy "Purchases: admins can insert"
  on public.user_purchases for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Purchases: admins can update"
  on public.user_purchases for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Purchases: admins can delete"
  on public.user_purchases for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Migration 2: Harden user_roles INSERT — constrain role value to known enum members
drop policy if exists "Roles: admins can insert" on public.user_roles;

create policy "Roles: admins can insert"
  on public.user_roles for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    and role = any (array['user'::public.app_role, 'expert'::public.app_role, 'admin'::public.app_role])
  );
