

User wants their actual table data exported as CSV — this is a one-off data export task, not a feature build. They mentioned earlier they want to migrate this product locally, so this is the data-export step from `MIGRATION.md`.

The 11 tables to export (from the schema above):
1. `certified_materia_medica`
2. `consult_messages`
3. `consults`
4. `prescription_audit`
5. `prescriptions`
6. `profiles`
7. `role_audit_log`
8. `user_purchases`
9. `user_roles`
10. `wisdom_protocols`
11. `wisdom_sources`

Plus `auth.users` (separate — Supabase admin schema, contains emails/OAuth identities needed for migration).

## Plan

A one-off export job — no code changes, no feature build. I'll:

1. Query each public table via `supabase--read_query` (SELECT *) and write each result to `/mnt/documents/exports/{table}.csv`
2. Query `auth.users` for the minimum migration-relevant fields (`id`, `email`, `created_at`, `last_sign_in_at`, `raw_user_meta_data`, `raw_app_meta_data`) — **without** password hashes (those are not exposed via read_query and need a separate Supabase dashboard export)
3. Bundle everything into `/mnt/documents/vital-logic-data-export.zip` for one-click download
4. Include a short `README.txt` in the zip explaining: row counts per table, column order, the auth.users caveat (password hashes need separate export), and the import command snippet (`\copy public.{table} FROM '{table}.csv' CSV HEADER`)
5. Emit each CSV + the zip as `<lov-artifact>` tags so they're downloadable

### What you get
- 11 individual `.csv` files (one per public table)
- 1 `auth_users.csv` (metadata only, no password hashes)
- 1 `README.txt` with row counts + import instructions
- 1 `vital-logic-data-export.zip` bundling all of the above

### Caveats I'll call out
- **Password hashes**: not included. Export them via Supabase Dashboard → Authentication → Users → Export, or users will need to re-set passwords / re-link OAuth on the local instance.
- **Storage objects**: none configured in this project — nothing to export.
- **Edge function secrets**: not data, must be re-created locally per `MIGRATION.md`.
- **Schema**: already in `supabase/migrations/` — `supabase db reset` re-applies it locally.

### Files touched
None in the repo. Output goes to `/mnt/documents/exports/` + a zip at `/mnt/documents/vital-logic-data-export.zip`.

