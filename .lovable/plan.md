

Looking at the findings:

**Finding 1 (error): `user_purchases` missing write policies**
- Table currently has only SELECT policies. No INSERT/UPDATE/DELETE policies = with RLS enabled, writes from clients are blocked by default. But the scanner flags this as fragile — explicit deny-by-policy is safer than relying on absence.
- Reality: today no client code writes to this table; it's intended for server-side/admin writes only. We should add explicit policies that lock writes down to admins (and service role bypasses RLS automatically).

**Finding 2 (warn): `user_roles` self-insert risk**
- Reviewing actual policies (from the schema dump): INSERT policy exists with `WITH CHECK has_role(auth.uid(), 'admin')`, plus the `guard_user_roles_write` trigger as defence-in-depth. Self-promotion via API is already blocked.
- The scanner's concern is largely already addressed. But two hardenings worth doing:
  1. The trigger allows `auth.uid() is null` (service-role path) — fine, but worth keeping explicit.
  2. Add `WITH CHECK` to the admins-can-insert policy to also constrain which role values can be granted (already on UPDATE; missing on INSERT).

## Plan

### Migration 1 — Lock down `user_purchases` writes
Add three explicit policies (admin-only writes; service role bypasses RLS so server-side fulfilment still works):

```sql
-- INSERT: admins only (service role bypasses RLS)
create policy "Purchases: admins can insert"
  on public.user_purchases for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- UPDATE: admins only
create policy "Purchases: admins can update"
  on public.user_purchases for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- DELETE: admins only
create policy "Purchases: admins can delete"
  on public.user_purchases for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));
```

### Migration 2 — Harden `user_roles` INSERT
Tighten the existing admin INSERT policy so it also constrains the role value (parity with the UPDATE policy):

```sql
drop policy if exists "Roles: admins can insert" on public.user_roles;

create policy "Roles: admins can insert"
  on public.user_roles for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    and role = any (array['user'::public.app_role, 'expert'::public.app_role, 'admin'::public.app_role])
  );
```

The `guard_user_roles_write` trigger remains as defence-in-depth.

### No code changes needed
- `/expert/admin/roles` already calls `user_roles` insert/delete as an authenticated admin — passes the tightened policy.
- No client code writes to `user_purchases` today; future fulfilment flows should use the server-side admin client (`supabaseAdmin`) which bypasses RLS, or be gated through admin UI.

### Verification after apply
1. Re-run security scan → both findings resolved/downgraded
2. As admin in `/expert/admin/roles` → grant/revoke still works
3. As non-admin → direct API attempt to insert into `user_purchases` or `user_roles` is rejected
4. Server-side flows using `supabaseAdmin` are unaffected (service role bypasses RLS)

### Files touched
- 1 new migration file under `supabase/migrations/`
- No application code changes

