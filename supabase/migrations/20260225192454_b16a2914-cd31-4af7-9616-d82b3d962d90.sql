
-- Drop existing SELECT and UPDATE policies on work_orders
DROP POLICY IF EXISTS "Users can view own work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Admins can view all work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Users can update own work orders" ON public.work_orders;

-- All authenticated users can view all work orders
CREATE POLICY "Authenticated users can view all work orders"
ON public.work_orders FOR SELECT TO authenticated
USING (true);

-- All authenticated users can update non-completed work orders
CREATE POLICY "Users can update non-completed work orders"
ON public.work_orders FOR UPDATE TO authenticated
USING (status NOT IN ('completed', 'invoiced'));

-- Admins can update any work order (including completed)
CREATE POLICY "Admins can update all work orders"
ON public.work_orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also update related tables so everyone can see all work order time/materials
DROP POLICY IF EXISTS "Users can view own wo time" ON public.work_order_time;
DROP POLICY IF EXISTS "Admins can view all work order time" ON public.work_order_time;
CREATE POLICY "Authenticated users can view all wo time"
ON public.work_order_time FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can view own wo materials" ON public.work_order_materials;
DROP POLICY IF EXISTS "Admins can view all work order materials" ON public.work_order_materials;
CREATE POLICY "Authenticated users can view all wo materials"
ON public.work_order_materials FOR SELECT TO authenticated
USING (true);
