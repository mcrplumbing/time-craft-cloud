
-- Allow admins to update all time entries
CREATE POLICY "Admins can update all time entries"
  ON public.time_entries FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
