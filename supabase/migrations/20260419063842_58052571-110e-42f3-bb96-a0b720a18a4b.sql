-- Allow authenticated users to claim an anonymous consult (user_id IS NULL → set to themselves)
CREATE POLICY "Consults: claim anonymous"
ON public.consults
FOR UPDATE
TO authenticated
USING (user_id IS NULL)
WITH CHECK (auth.uid() = user_id);