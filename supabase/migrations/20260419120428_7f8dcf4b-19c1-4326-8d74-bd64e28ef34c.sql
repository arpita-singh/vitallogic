
-- 1. Add anon_token_hash columns
ALTER TABLE public.consults
  ADD COLUMN IF NOT EXISTS anon_token_hash text;

ALTER TABLE public.consult_messages
  ADD COLUMN IF NOT EXISTS anon_token_hash text;

CREATE INDEX IF NOT EXISTS idx_consults_anon_token_hash
  ON public.consults(anon_token_hash)
  WHERE anon_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consult_messages_anon_token_hash
  ON public.consult_messages(anon_token_hash)
  WHERE anon_token_hash IS NOT NULL;

-- 2. Drop overly-permissive policies
DROP POLICY IF EXISTS "Consults: anyone can select anonymous" ON public.consults;
DROP POLICY IF EXISTS "Consults: anyone can update anonymous" ON public.consults;
DROP POLICY IF EXISTS "Messages: anyone can select for anonymous consults" ON public.consult_messages;
DROP POLICY IF EXISTS "Messages: owner can insert via consult" ON public.consult_messages;

-- 3. Tighten the public insert policy on consults: anonymous inserts must
--    carry a non-null anon_token_hash so we can verify ownership later.
DROP POLICY IF EXISTS "Consults: anyone can insert" ON public.consults;
CREATE POLICY "Consults: anyone can insert"
  ON public.consults
  FOR INSERT
  WITH CHECK (
    -- Signed-in user creating a consult for themselves
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    -- Anonymous insert: must have a non-null token hash and no user_id
    (user_id IS NULL AND anon_token_hash IS NOT NULL)
  );

-- 4. Re-add a tighter "owner can insert via consult" policy on messages for
--    the SIGNED-IN case only. Anonymous messages will be inserted server-side
--    with the service role key, so they don't need a public RLS path.
CREATE POLICY "Messages: owner can insert via consult"
  ON public.consult_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consults c
      WHERE c.id = consult_messages.consult_id
        AND c.user_id = auth.uid()
    )
  );
