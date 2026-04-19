-- Allow anyone to read messages for anonymous consults, mirroring
-- "Consults: anyone can select anonymous" on the consults table.
-- Without this, the patient who just submitted an anonymous intake
-- cannot load their own AI chat, because the existing message policy
-- requires c.user_id = auth.uid(), which fails for NULL user_id.
CREATE POLICY "Messages: anyone can select for anonymous consults"
ON public.consult_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.consults c
    WHERE c.id = consult_messages.consult_id
      AND c.user_id IS NULL
  )
);