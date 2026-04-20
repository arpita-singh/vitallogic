

## What happened
The 11 public-table CSVs exported correctly. `auth_users.csv` failed because the read-only Postgres role used for ad-hoc queries cannot read Supabase's `auth` schema — that's intentional protection so OAuth tokens, password hashes, and identities can't be exfiltrated by a SQL query.

## Three ways forward — pick one

**Option A — Fix it server-side (recommended)** 
Run a small one-off script that uses the service-role key (already configured as `SUPABASE_SERVICE_ROLE_KEY`) to call `supabase.auth.admin.listUsers()`. This is the official admin API, returns every user with `id`, `email`, `created_at`, `last_sign_in_at`, `email_confirmed_at`, `raw_user_meta_data`, `raw_app_meta_data`, and OAuth `identities`. Replaces the broken `auth_users.csv` in the existing zip. **Still no password hashes** — those are never returned by the API; they require the dashboard export path.

**Option B — Dashboard export for everything auth-related**
Lovable Cloud → Users → Export. Gives you a CSV with metadata *and* allows password-hash export for true lift-and-shift. This is the only path that preserves existing passwords on the local instance.

**Option C — Skip auth migration entirely**
Don't move `auth.users`. On the local instance, users re-sign-up (or you seed test accounts). Simplest if you're treating the local fork as a dev environment, not a production cutover.

## My recommendation
**Both A and B.** A gets you a clean machine-readable user list (emails, OAuth links, metadata) so you can script account re-creation. B gets you the password hashes so existing users don't have to reset.

## What I'll do if you approve Option A
1. Write a one-off Node script that uses `@supabase/supabase-js` with the service-role key to page through `auth.admin.listUsers()` (1000/page)
2. Flatten each user to a CSV row with: `id, email, phone, created_at, last_sign_in_at, email_confirmed_at, raw_user_meta_data (JSON), raw_app_meta_data (JSON), identities (JSON)`
3. Overwrite `/mnt/documents/exports/auth_users.csv` with the real data
4. Rebuild `/mnt/documents/vital-logic-data-export.zip` so the bundle is correct
5. Update the in-zip `README.txt` to note: "Password hashes not included — export separately via Lovable Cloud → Users → Export if needed"
6. Re-emit the zip as a downloadable artifact

No code changes to the app, no schema changes, no new files in the repo.

### Verification
1. `auth_users.csv` opens with real rows (one per user) instead of an error message
2. New zip contains the corrected `auth_users.csv` and all 11 public CSVs
3. README explains the password-hash caveat clearly

