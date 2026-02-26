CREATE POLICY "Admins can delete all time entries"
ON public.time_entries
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));