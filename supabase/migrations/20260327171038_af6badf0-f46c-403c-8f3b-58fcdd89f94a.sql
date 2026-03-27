
ALTER TABLE public.custom_songs ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE public.custom_songs ADD COLUMN IF NOT EXISTS genre text;
