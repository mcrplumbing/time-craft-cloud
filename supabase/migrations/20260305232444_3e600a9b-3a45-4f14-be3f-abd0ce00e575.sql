
-- Add soft-delete column to time_entries
ALTER TABLE public.time_entries ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Add soft-delete column to work_orders
ALTER TABLE public.work_orders ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Update existing RLS policies won't filter by deleted_at automatically,
-- so we need to update the SELECT policies to exclude soft-deleted rows for non-trash views.
-- We'll handle filtering in application code instead to keep it simpler.

-- Admin policy to see deleted entries (for trash view) - already covered by existing admin SELECT policies
