-- Remove the permissive anon-or-owner insert policy on consults.
-- Anonymous consult creation now goes exclusively through the startConsult
-- server function (service role), which sets anon_token_hash and bypasses RLS.
drop policy if exists "Consults: anyone can insert" on public.consults;

-- Authenticated owner can still insert their own consult directly.
create policy "Consults: authenticated owner can insert"
on public.consults
for insert
to authenticated
with check (auth.uid() = user_id);