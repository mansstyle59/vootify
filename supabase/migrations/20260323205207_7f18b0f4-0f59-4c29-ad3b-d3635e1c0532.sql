
-- Custom songs added manually by users
CREATE TABLE public.custom_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  cover_url TEXT,
  stream_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own custom songs" ON public.custom_songs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own custom songs" ON public.custom_songs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom songs" ON public.custom_songs FOR DELETE USING (auth.uid() = user_id);

-- Custom albums
CREATE TABLE public.custom_albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_url TEXT,
  year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own custom albums" ON public.custom_albums FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own custom albums" ON public.custom_albums FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom albums" ON public.custom_albums FOR DELETE USING (auth.uid() = user_id);

-- Custom radio stations
CREATE TABLE public.custom_radio_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  genre TEXT,
  cover_url TEXT,
  stream_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_radio_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own custom stations" ON public.custom_radio_stations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own custom stations" ON public.custom_radio_stations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom stations" ON public.custom_radio_stations FOR DELETE USING (auth.uid() = user_id);
