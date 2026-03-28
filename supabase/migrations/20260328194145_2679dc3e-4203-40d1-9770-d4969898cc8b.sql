
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings" ON public.app_settings
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
