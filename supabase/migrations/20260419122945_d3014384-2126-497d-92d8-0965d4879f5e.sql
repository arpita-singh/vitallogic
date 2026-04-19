-- Drop the wide-open anonymous-claim RLS policy.
-- Claims must now go through the claimConsult server function, which verifies
-- either the anon_token_hash or a matching verified email server-side.
drop policy if exists "Consults: claim anonymous" on public.consults;