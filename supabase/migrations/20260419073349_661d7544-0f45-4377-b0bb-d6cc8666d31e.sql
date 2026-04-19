-- Allow anonymous (and any) updates on consults that have no owner yet,
-- so visitors can attach contact info to their just-started consult.
-- Updates cannot transfer ownership: with_check requires user_id to remain null.
CREATE POLICY "Consults: anyone can update anonymous"
ON public.consults
FOR UPDATE
TO public
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);