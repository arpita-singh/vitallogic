CREATE POLICY "Profiles: admins can select all"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));