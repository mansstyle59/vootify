ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS requested_duration integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS requested_duration_unit text DEFAULT 'days';