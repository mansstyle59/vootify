
-- Table to track playlists shared by admin to users
CREATE TABLE public.shared_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_name text NOT NULL,
  cover_url text,
  shared_by uuid NOT NULL,
  shared_to uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table for songs within shared playlists
CREATE TABLE public.shared_playlist_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_playlist_id uuid NOT NULL REFERENCES public.shared_playlists(id) ON DELETE CASCADE,
  song_id text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  cover_url text,
  stream_url text,
  duration integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.shared_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_playlist_songs ENABLE ROW LEVEL SECURITY;

-- Users can read playlists shared to them
CREATE POLICY "Users can read own shared playlists"
ON public.shared_playlists FOR SELECT TO authenticated
USING (shared_to = auth.uid());

-- Admins can manage all shared playlists
CREATE POLICY "Admins can manage shared playlists"
ON public.shared_playlists FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read songs of their shared playlists
CREATE POLICY "Users can read shared playlist songs"
ON public.shared_playlist_songs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shared_playlists sp
  WHERE sp.id = shared_playlist_id AND (sp.shared_to = auth.uid() OR public.has_role(auth.uid(), 'admin'))
));

-- Admins can manage shared playlist songs
CREATE POLICY "Admins can manage shared playlist songs"
ON public.shared_playlist_songs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
