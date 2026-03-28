
-- Plan prices table (editable by admins)
CREATE TABLE public.plan_prices (
  plan TEXT PRIMARY KEY,
  price TEXT NOT NULL DEFAULT '0',
  period TEXT NOT NULL DEFAULT '/mois',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

-- Anyone can read prices
CREATE POLICY "Anyone can read plan prices"
  ON public.plan_prices FOR SELECT
  TO public
  USING (true);

-- Admins can manage prices
CREATE POLICY "Admins can manage plan prices"
  ON public.plan_prices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default values
INSERT INTO public.plan_prices (plan, price, period) VALUES
  ('premium', '4.99€', '/mois'),
  ('gold', '9.99€', '/mois'),
  ('vip', '14.99€', '/mois');
