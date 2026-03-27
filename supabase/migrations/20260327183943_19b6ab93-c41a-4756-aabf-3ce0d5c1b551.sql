ALTER TABLE public.shared_playlists 
ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Update existing shared playlists to 'accepted' so they remain visible
UPDATE public.shared_playlists SET status = 'accepted';