CREATE TABLE public.friday_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id integer NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  cover_url text,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(album_id)
);

ALTER TABLE public.friday_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read friday releases"
ON public.friday_releases FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anon can read friday releases"
ON public.friday_releases FOR SELECT
TO anon
USING (true);