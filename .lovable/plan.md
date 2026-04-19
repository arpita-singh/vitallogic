

## Fix — `prescriptions_realtime_no_rls_channel_auth`

### Root cause
The `prescriptions` table is in the `supabase_realtime` publication, so any authenticated client can `supabase.channel(...).on('postgres_changes', { table: 'prescriptions' })` and receive every row change — including `draft`, `final`, `review_notes`. Postgres-level RLS on `prescriptions` does not gate Realtime broadcast; Realtime needs its own authorization on `realtime.messages`.

### Investigation
Let me first check whether the app actually uses Realtime on `prescriptions` — if nothing subscribes, the simplest fix is to remove the table from the publication entirely.

Searching: `src/routes/_authenticated/_expert/expert.tsx`, `expert_.$prescriptionId.tsx`, `consult_.$consultId.index.tsx`, `consult_.$consultId.result.tsx` for `.channel(` / `postgres_changes` / `prescriptions`.

Based on the codebase index (no realtime subscriptions visible in the earlier excerpts of `consult_.$consultId.index.tsx` / `result.tsx`, and the expert dashboard polls via queries), I'll verify this in the implementation pass. Two scenarios:

- **Scenario A (likely): no client uses Realtime on `prescriptions`.** Drop the table from the `supabase_realtime` publication. No app changes. Closes the finding completely.
- **Scenario B: something does subscribe.** Keep it published but enable Realtime Authorization and add RLS policies on `realtime.messages` that only permit topics like `prescription:<consult_id>` for the consult owner or for users with `expert`/`admin` role.

### Plan

**Step 1 — Migration (always run):** Remove `prescriptions` from the realtime publication. This is the safest default and matches what the code appears to do (no live subscription needed; expert reviews via fetch + manual refresh).

```sql
alter publication supabase_realtime drop table public.prescriptions;
```

Also do the same for `consult_messages` and `consults` if they're in the publication and unused — I'll check during implementation and only drop ones that are actually published and unused.

**Step 2 — Only if Scenario B turns out to be true** (a Realtime subscription on `prescriptions` exists in the client and removing it would break UX): keep the publication and instead enable Realtime Authorization with RLS on `realtime.messages`:

```sql
-- Enable Realtime Authorization
alter table realtime.messages enable row level security;

create policy "Realtime: experts/admins can read prescription topics"
on realtime.messages for select to authenticated
using (
  realtime.topic() like 'prescription:%'
  and (has_role(auth.uid(), 'expert') or has_role(auth.uid(), 'admin'))
);

create policy "Realtime: owner can read own prescription topics"
on realtime.messages for select to authenticated
using (
  realtime.topic() like 'prescription:%'
  and exists (
    select 1 from public.prescriptions p
    join public.consults c on c.id = p.consult_id
    where 'prescription:' || p.consult_id::text = realtime.topic()
      and c.user_id = auth.uid()
  )
);
```
And refactor any client subscriptions to use private channels with `topic = 'prescription:<consult_id>'`.

### Files to change
- New migration: `supabase/migrations/<ts>_lock_prescriptions_realtime.sql`
- (Scenario B only) any route file that subscribes to `prescriptions` realtime

### Quick runtime-error note (also from current preview)
The `Missing Supabase server environment variables` error in `client.server.ts` is unrelated to this finding but is breaking pages right now. I'll relax the lookup to also accept `import.meta.env.SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` as fallbacks before throwing, so SSR doesn't crash when the Worker's `process.env` shim is empty. Small, contained fix in the same pass.

### Out of scope (separate findings)
- `has_role_ignores_user_id_parameter` (warn) — already neutralized for the exploit path; can revisit signature later.
- `claim_consult_idor` — already fixed in the previous pass; will mark as resolved.
- `consult_messages` anonymous read/write hardening.

### Expected result
- `prescriptions` no longer broadcasts row changes to arbitrary subscribers.
- Security scan no longer reports `prescriptions_realtime_no_rls_channel_auth`.
- No UX regression (expert dashboard already fetches on demand).

