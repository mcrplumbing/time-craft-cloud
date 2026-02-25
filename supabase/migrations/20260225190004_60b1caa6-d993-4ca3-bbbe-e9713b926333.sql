
ALTER TABLE public.time_entries
  ADD COLUMN break_start timestamptz DEFAULT NULL,
  ADD COLUMN break_end timestamptz DEFAULT NULL;
