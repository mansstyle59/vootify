
CREATE TABLE public.home_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL
);

ALTER TABLE public.home_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read the global config
CREATE POLICY "Anyone can read home config"
  ON public.home_config FOR SELECT
  TO public
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage home config"
  ON public.home_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
