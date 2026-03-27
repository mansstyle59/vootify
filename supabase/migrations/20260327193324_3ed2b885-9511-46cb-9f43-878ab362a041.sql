
CREATE TABLE public.artist_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_name text NOT NULL UNIQUE,
  image_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL
);

ALTER TABLE public.artist_images ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read artist images"
  ON public.artist_images FOR SELECT
  TO public
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage artist images"
  ON public.artist_images FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
