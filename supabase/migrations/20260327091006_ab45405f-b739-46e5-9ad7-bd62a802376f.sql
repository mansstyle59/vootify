
CREATE TABLE public.resolve_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id text NOT NULL,
  original_title text NOT NULL,
  original_artist text NOT NULL,
  resolved_title text,
  resolved_artist text,
  source text NOT NULL DEFAULT 'none',
  stream_url text NOT NULL DEFAULT '',
  title_corrected boolean NOT NULL DEFAULT false,
  artist_corrected boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.resolve_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read resolve logs" ON public.resolve_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert resolve logs" ON public.resolve_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can delete resolve logs" ON public.resolve_logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_resolve_logs_created_at ON public.resolve_logs (created_at DESC);
CREATE INDEX idx_resolve_logs_source ON public.resolve_logs (source);
