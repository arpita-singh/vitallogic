

# Phase 2 — Cloud, Schema, Auth & Guards

## 1. Enable Lovable Cloud
Turn on Cloud so we get Supabase (Postgres + Auth) and the auto-generated `client.ts` / `auth-middleware.ts` / `client.server.ts`.

## 2. Database schema (one migration)

**Enums**
- `app_role`: `'user' | 'expert' | 'admin'`
- `consult_status`: `'draft' | 'pending_review' | 'approved' | 'rejected' | 'escalated'`
- `prescription_status`: same as consult_status minus `draft`

**Tables (all RLS enabled)**
- `profiles` — `id (uuid PK → auth.users)`, `display_name`, `avatar_url`, `created_at`. Trigger `handle_new_user()` auto-creates row on signup.
- `user_roles` — `id`, `user_id → auth.users`, `role app_role`, unique `(user_id, role)`. **Roles live here, never on profiles.**
- `consults` — `id`, `user_id (nullable for anon)`, `intake jsonb`, `status consult_status`, `created_at`, `updated_at`.
- `consult_messages` — `id`, `consult_id`, `role ('user'|'assistant'|'system')`, `content text`, `created_at`.
- `prescriptions` — `id`, `consult_id`, `draft jsonb`, `final jsonb null`, `status`, `reviewed_by null`, `reviewed_at null`, `review_notes`, `created_at`.
- `prescription_audit` — `id`, `prescription_id`, `actor_id`, `action`, `diff jsonb`, `created_at`.

**Security definer function**
```sql
create function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
```

**RLS policy summary**
- `profiles`: owner select/update; everyone insert own row.
- `user_roles`: user can select own roles; only admins insert/update/delete (`has_role(auth.uid(),'admin')`).
- `consults`: owner CRUD own rows; experts/admins select all `pending_review`/`escalated`/`approved`/`rejected`; anon inserts allowed (user_id null).
- `consult_messages`: same access pattern as parent consult (via subquery on consult ownership + role checks).
- `prescriptions`: owner select if `status='approved'`; experts/admins select+update all; insert via server only.
- `prescription_audit`: insert by experts/admins; select by experts/admins.

## 3. Auth client wiring
- `src/lib/auth.tsx` — `AuthProvider` + `useAuth()` hook. Wraps `supabase.auth.onAuthStateChange` (set up BEFORE `getSession()`), exposes `{ user, session, roles, isAuthenticated, hasRole, signIn, signUp, signOut, loading }`.
- Fetches roles from `user_roles` after session resolves; memoizes `hasRole`.
- Mount provider in `__root.tsx` around `<Outlet />`.
- Pass `auth` into router context via `createRootRouteWithContext<{ auth: AuthState }>` so `beforeLoad` guards can read it.

## 4. Routes added

**Public**
- `/login` — email + password, link to `/signup` and forgot password (stub for now).
- `/signup` — email + password + display name. Uses `emailRedirectTo: window.location.origin`. After signup, redirect to `/account`.
- `/reset-password` — required pair for future forgot-password (mounted now, simple form).

**Protected layout `_authenticated.tsx`** (pathless)
- `beforeLoad` checks `context.auth.isAuthenticated`; throws `redirect({ to:'/login', search:{ redirect: location.href }})`.
- Children:
  - `_authenticated/account.tsx` — display name, email, sign-out, link to "My consults" (placeholder list — Phase 3 will populate).

**Expert-only layout `_authenticated/_expert.tsx`** (pathless)
- `beforeLoad` checks `context.auth.hasRole('expert') || context.auth.hasRole('admin')`; otherwise redirect to `/unauthorized`.
- Children:
  - `_authenticated/_expert/expert.tsx` → `/expert` — placeholder queue page ("Phase 3 will wire this up").

**Misc**
- `/unauthorized` — friendly "you don't have access" page with link home.

## 5. Header updates
- `SiteHeader`: when authenticated, swap "Start consult" CTA group to show "Account" link + "Sign out"; when expert/admin, also show "Expert" link.

## 6. Files to create / edit
- New: `src/lib/auth.tsx`, `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/reset-password.tsx`, `src/routes/unauthorized.tsx`, `src/routes/_authenticated.tsx`, `src/routes/_authenticated/account.tsx`, `src/routes/_authenticated/_expert.tsx`, `src/routes/_authenticated/_expert/expert.tsx`.
- Edit: `src/routes/__root.tsx` (AuthProvider + router context type), `src/router.tsx` (context shape), `src/components/site-header.tsx` (auth-aware nav).
- Migration: one SQL file with enums, tables, trigger, `has_role`, all RLS policies.

## 7. Out of scope (next phase)
Intake stepper UI, AI chat edge function, prescription generation, expert review actions, audit writes — all Phase 3.

