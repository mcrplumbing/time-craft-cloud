CREATE POLICY "Admins can delete all work orders"
ON public.work_orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));