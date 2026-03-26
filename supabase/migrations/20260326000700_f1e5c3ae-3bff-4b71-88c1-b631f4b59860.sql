
-- ============================================
-- Helper: check if user owns a playlist
-- ============================================
CREATE OR REPLACE FUNCTION public.owns_playlist(_user_id uuid, _playlist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.playlists
    WHERE id = _playlist_id AND user_id = _user_id
  )
$$;

-- ============================================
-- 1. PROFILES
-- ============================================
DROP POLICY IF EXISTS "Allow all access to profiles" ON public.profiles;

CREATE POLICY "Users can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 2. CUSTOM_SONGS
-- ============================================
DROP POLICY IF EXISTS "Allow all access to custom songs" ON public.custom_songs;

CREATE POLICY "Users can read all custom songs" ON public.custom_songs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own custom songs" ON public.custom_songs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own custom songs" ON public.custom_songs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own custom songs" ON public.custom_songs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 3. CUSTOM_ALBUMS
-- ============================================
DROP POLICY IF EXISTS "Allow all access to custom albums" ON public.custom_albums;

CREATE POLICY "Users can read all custom albums" ON public.custom_albums
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own custom albums" ON public.custom_albums
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own custom albums" ON public.custom_albums
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own custom albums" ON public.custom_albums
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 4. CUSTOM_RADIO_STATIONS
-- ============================================
DROP POLICY IF EXISTS "Allow all access to custom radio stations" ON public.custom_radio_stations;

CREATE POLICY "Users can read all custom radios" ON public.custom_radio_stations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own custom radios" ON public.custom_radio_stations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own custom radios" ON public.custom_radio_stations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own custom radios" ON public.custom_radio_stations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 5. LIKED_SONGS
-- ============================================
DROP POLICY IF EXISTS "Allow all access to liked songs" ON public.liked_songs;

CREATE POLICY "Users can read own liked songs" ON public.liked_songs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own liked songs" ON public.liked_songs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own liked songs" ON public.liked_songs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own liked songs" ON public.liked_songs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 6. RECENTLY_PLAYED
-- ============================================
DROP POLICY IF EXISTS "Allow all access to recently played" ON public.recently_played;

CREATE POLICY "Users can read own recently played" ON public.recently_played
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own recently played" ON public.recently_played
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own recently played" ON public.recently_played
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own recently played" ON public.recently_played
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 7. PLAYLISTS
-- ============================================
DROP POLICY IF EXISTS "Allow all access to playlists" ON public.playlists;

CREATE POLICY "Users can read own playlists" ON public.playlists
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own playlists" ON public.playlists
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own playlists" ON public.playlists
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own playlists" ON public.playlists
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 8. PLAYLIST_SONGS
-- ============================================
DROP POLICY IF EXISTS "Allow all access to playlist songs" ON public.playlist_songs;

CREATE POLICY "Users can read own playlist songs" ON public.playlist_songs
  FOR SELECT TO authenticated USING (public.owns_playlist(auth.uid(), playlist_id));

CREATE POLICY "Users can insert own playlist songs" ON public.playlist_songs
  FOR INSERT TO authenticated WITH CHECK (public.owns_playlist(auth.uid(), playlist_id));

CREATE POLICY "Users can update own playlist songs" ON public.playlist_songs
  FOR UPDATE TO authenticated USING (public.owns_playlist(auth.uid(), playlist_id)) WITH CHECK (public.owns_playlist(auth.uid(), playlist_id));

CREATE POLICY "Users can delete own playlist songs" ON public.playlist_songs
  FOR DELETE TO authenticated USING (public.owns_playlist(auth.uid(), playlist_id));
