-- Drop all existing RLS policies and allow public access
-- custom_albums
DROP POLICY IF EXISTS "Users can view own custom albums" ON public.custom_albums;
DROP POLICY IF EXISTS "Users can insert own custom albums" ON public.custom_albums;
DROP POLICY IF EXISTS "Users can delete own custom albums" ON public.custom_albums;
CREATE POLICY "Allow all access to custom albums" ON public.custom_albums FOR ALL USING (true) WITH CHECK (true);

-- custom_radio_stations
DROP POLICY IF EXISTS "Users can view own custom stations" ON public.custom_radio_stations;
DROP POLICY IF EXISTS "Users can insert own custom stations" ON public.custom_radio_stations;
DROP POLICY IF EXISTS "Users can delete own custom stations" ON public.custom_radio_stations;
CREATE POLICY "Allow all access to custom radio stations" ON public.custom_radio_stations FOR ALL USING (true) WITH CHECK (true);

-- custom_songs
DROP POLICY IF EXISTS "Users can view own custom songs" ON public.custom_songs;
DROP POLICY IF EXISTS "Users can insert own custom songs" ON public.custom_songs;
DROP POLICY IF EXISTS "Users can delete own custom songs" ON public.custom_songs;
CREATE POLICY "Allow all access to custom songs" ON public.custom_songs FOR ALL USING (true) WITH CHECK (true);

-- liked_songs
DROP POLICY IF EXISTS "Users can view own liked songs" ON public.liked_songs;
DROP POLICY IF EXISTS "Users can insert own liked songs" ON public.liked_songs;
DROP POLICY IF EXISTS "Users can delete own liked songs" ON public.liked_songs;
CREATE POLICY "Allow all access to liked songs" ON public.liked_songs FOR ALL USING (true) WITH CHECK (true);

-- playlist_songs
DROP POLICY IF EXISTS "Users can view own playlist songs" ON public.playlist_songs;
DROP POLICY IF EXISTS "Users can insert own playlist songs" ON public.playlist_songs;
DROP POLICY IF EXISTS "Users can delete own playlist songs" ON public.playlist_songs;
CREATE POLICY "Allow all access to playlist songs" ON public.playlist_songs FOR ALL USING (true) WITH CHECK (true);

-- playlists
DROP POLICY IF EXISTS "Users can view own playlists" ON public.playlists;
DROP POLICY IF EXISTS "Users can insert own playlists" ON public.playlists;
DROP POLICY IF EXISTS "Users can delete own playlists" ON public.playlists;
DROP POLICY IF EXISTS "Users can update own playlists" ON public.playlists;
CREATE POLICY "Allow all access to playlists" ON public.playlists FOR ALL USING (true) WITH CHECK (true);

-- recently_played
DROP POLICY IF EXISTS "Users can view own recently played" ON public.recently_played;
DROP POLICY IF EXISTS "Users can insert own recently played" ON public.recently_played;
DROP POLICY IF EXISTS "Users can delete own recently played" ON public.recently_played;
CREATE POLICY "Allow all access to recently played" ON public.recently_played FOR ALL USING (true) WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Allow all access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);