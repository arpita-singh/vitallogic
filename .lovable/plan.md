

User wants admin UI to assign roles to other users. This is the #3 gap I flagged in the previous CMS recommendation. Let me scope concretely.

**What exists:**
- `user_roles` table with `app_role` enum (`user`, `expert`, `admin`)
- `has_role()` SECURITY DEFINER function
- `guard_user_roles_write()` trigger ensures only admins can insert/update/delete roles
- RLS on `user_roles`: admins can SELECT all, users can SELECT own
- `profiles` table with `display_name`, `avatar_url` — admin can SELECT only own (not others) per current RLS

**Gap blocker:** Current `profiles` RLS only lets owner select own. Admins can't list other users to assign roles to them. Need an admin-read RLS policy on `profiles`.

**Plan**

## Add admin role-management screen

### 1. Database (migration)
- Add RLS policy: `Profiles: admins can select all` → `has_role(auth.uid(), 'admin')`
- No schema changes needed — `user_roles`, trigger, and write policies already exist and are correct

### 2. Route
- New file: `src/routes/_authenticated/_expert/expert_.admin.roles.tsx` → `/expert/admin/roles`
- Gate inside the component: only `admin` role passes; `expert`-only users see "Admins only" message (the `_expert` layout already handles expert+admin; we tighten to admin here)

### 3. UI (single page)
- Search box: filter by display name or email fragment
- Table of users: `display_name`, `user_id` (truncated), current roles as badges
- Per-row actions: toggle `expert` and `admin` chips (insert/delete in `user_roles`)
- Cannot remove your own `admin` role (guard against locking yourself out)
- Toast on success/failure; optimistic refresh of the row

### 4. Data wiring
- List query joins `profiles` + aggregated `user_roles` per user (two queries client-side, merged in memory — small dataset, no need for an RPC yet)
- Mutations: `supabase.from('user_roles').insert({ user_id, role })` and `.delete().eq(...)` — RLS + trigger enforces admin-only

### 5. Navigation
- Add "Admin · Roles" link in expert page header (only visible to admins)

### Files touched
- New migration (admin SELECT on profiles)
- New: `src/routes/_authenticated/_expert/expert_.admin.roles.tsx`
- Edit: `src/routes/_authenticated/_expert/expert.tsx` (add admin-only nav link)

### Verification
1. As admin → `/expert/admin/roles` lists all profiles, can grant/revoke `expert` and `admin`
2. As expert (non-admin) → page shows "Admins only" guard
3. Admin cannot remove own admin role (button disabled)
4. Non-admin attempting direct insert via console → blocked by `guard_user_roles_write` trigger
5. Newly granted expert can immediately access `/expert` queue

