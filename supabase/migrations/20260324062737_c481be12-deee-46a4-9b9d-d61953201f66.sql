INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);

CREATE POLICY "Allow public upload to covers"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'covers');

CREATE POLICY "Allow public read covers"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'covers');

CREATE POLICY "Allow public update covers"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'covers');

CREATE POLICY "Allow public delete covers"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'covers');