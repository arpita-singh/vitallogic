

## Diagnosis

The consult data is **not deleted** — it's all still in the database (1 consult, 6 prescriptions, 13 messages, all owned by your account). The problem is a permissions regression introduced by one of the recent security migrations.

### Root cause

The `has_role(_user_id, _role)` SECURITY DEFINER function was recreated by a recent migration. When you `CREATE OR REPLACE FUNCTION` in Postgres, all existing grants on that function are wiped. Compare current grants:

```
guard_user_roles_write → {anon=X, authenticated=X, service_role=X, ...}  ✅ default grants present
has_role               → {postgres=X, service_role=X, sandbox_exec=X}    ❌ no anon/authenticated
```

Because `has_role` is referenced in the SELECT RLS policies on `consults`, `prescriptions`, `consult_messages`, `user_purchases`, `prescription_audit`, `user_roles`, and `certified_materia_medica` (the "experts can select all" branch), Postgres tries to evaluate it for every authenticated query — and fails with:

```
{"code":"42501","message":"permission denied for function has_role"}
```

The browser network log confirms this: every `GET /rest/v1/consults` call from your account is returning 403 with that exact error. The owner-scoped `(auth.uid() = user_id)` policy never gets a chance because policy evaluation short-circuits when any referenced function isn't callable.

### Fix

A single one-line migration restoring the function's EXECUTE privileges:

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO anon, authenticated, service_role;
```

This is purely a permissions restoration — no schema change, no policy change, no security weakening. The function is still SECURITY DEFINER with `SET search_path = public`, and its body still only reads from `user_roles`, so granting EXECUTE to `authenticated` is exactly the original (and intended) state.

### Verification after applying

1. Reload `/account` — your existing consult should reappear with its "Awaiting review" / "Ready" status.
2. The approved-prescription banner at the top should show the 4 approved prescriptions.
3. Expert dashboard (if you have the role) should also reload correctly.

### Files changed
- New migration: `supabase/migrations/<timestamp>_restore_has_role_grants.sql`

### Out of scope
- No code changes. No RLS policy changes. The previous security fixes (input validation, role-write trigger, error masking) remain in place.

