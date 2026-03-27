CREATE POLICY "Anon can insert access requests"
ON public.access_requests
FOR INSERT
TO anon
WITH CHECK (true);