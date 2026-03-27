CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests"
  ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own requests"
  ON public.access_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all requests"
  ON public.access_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update requests"
  ON public.access_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));