

User wants to grant admin role to their own account (arpita.singh.syd@gmail.com). This is a bootstrap problem — the admin roles UI requires you to already be admin to use it. Need to check what roles this user currently has.

Two paths:
1. **If they already have admin** → just use `/expert/admin/roles` UI (but then they wouldn't be asking)
2. **If they don't have admin** → need a one-time SQL migration to seed the admin role for their `auth.users` row

The `guard_user_roles_write` trigger explicitly allows inserts when `auth.uid() is null` (service role / migration path), so a migration can safely seed the first admin.

Let me check current state.
<br>

## Bootstrap admin role for arpita.singh.syd@gmail.com

### Situation
The `/expert/admin/roles` UI requires you to already be an admin to grant roles to others — classic chicken-and-egg. To bootstrap the first admin we need a one-time database migration that runs as the service role (which the `guard_user_roles_write` trigger explicitly permits when `auth.uid()` is null).

### Step 1 — Confirm the account exists
Run a read-only query against `auth.users` to confirm the email is registered and capture its `id`. If it isn't there, you need to sign up at `/signup` first using that exact email, then we proceed.

### Step 2 — One-time migration to grant admin
Insert a row into `public.user_roles` for that user with role `admin`, idempotently (no-op if already present):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = 'arpita.singh.syd@gmail.com'
on conflict (user_id, role) do nothing;
```

Note: the `user_roles` table doesn't currently have a unique constraint on `(user_id, role)`. The migration will:
1. Add `unique (user_id, role)` to `public.user_roles` (safe — prevents duplicate role grants going forward)
2. Run the idempotent insert above

### Step 3 — Verify
After the migration:
1. Sign out and sign back in as `arpita.singh.syd@gmail.com` (so the client refetches roles)
2. Navigate to `/expert/admin/roles` — you should see the full user list and the "Admin · Roles" link in the expert header
3. From there you can grant `expert` / `admin` to any other account through the UI — no more SQL needed

### Files touched
- One new migration in `supabase/migrations/` (adds unique constraint + seeds admin)
- No app code changes

### If the account isn't registered yet
Sign up at `/signup` with `arpita.singh.syd@gmail.com` first, confirm the email, then approve this plan and I'll run the migration.

