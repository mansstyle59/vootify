
CREATE TABLE public.user_audio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  crossfade_enabled boolean NOT NULL DEFAULT true,
  crossfade_duration numeric NOT NULL DEFAULT 2,
  bass_boost numeric NOT NULL DEFAULT 0,
  treble_boost numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_audio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audio settings"
  ON public.user_audio_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own audio settings"
  ON public.user_audio_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own audio settings"
  ON public.user_audio_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
