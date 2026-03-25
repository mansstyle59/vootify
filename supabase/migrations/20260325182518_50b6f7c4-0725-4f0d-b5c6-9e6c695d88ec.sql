
-- Create audio storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read audio files
CREATE POLICY "Public read access for audio" ON storage.objects
FOR SELECT USING (bucket_id = 'audio');

-- Allow authenticated users to upload audio files
CREATE POLICY "Authenticated users can upload audio" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audio');

-- Allow authenticated users to delete their audio files
CREATE POLICY "Authenticated users can delete audio" ON storage.objects
FOR DELETE USING (bucket_id = 'audio');
