CREATE POLICY "Consults: anyone can select anonymous"
ON public.consults
FOR SELECT
USING (user_id IS NULL);