
-- Allow anonymous users full CRUD on custom_songs
CREATE POLICY "Anon can read custom songs" ON public.custom_songs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert custom songs" ON public.custom_songs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update custom songs" ON public.custom_songs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete custom songs" ON public.custom_songs FOR DELETE TO anon USING (true);

-- Allow anonymous users full CRUD on custom_albums
CREATE POLICY "Anon can read custom albums" ON public.custom_albums FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert custom albums" ON public.custom_albums FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update custom albums" ON public.custom_albums FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete custom albums" ON public.custom_albums FOR DELETE TO anon USING (true);

-- Allow anonymous users full CRUD on custom_radio_stations
CREATE POLICY "Anon can read custom radios" ON public.custom_radio_stations FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert custom radios" ON public.custom_radio_stations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update custom radios" ON public.custom_radio_stations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete custom radios" ON public.custom_radio_stations FOR DELETE TO anon USING (true);
