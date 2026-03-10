-- Drop the old check constraint first
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;

-- Migrate all non-completed statuses to 'active'
UPDATE public.work_orders SET status = 'active' WHERE status IN ('draft', 'in_progress', 'invoiced');

-- Add new check constraint
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_status_check CHECK (status IN ('active', 'completed'));