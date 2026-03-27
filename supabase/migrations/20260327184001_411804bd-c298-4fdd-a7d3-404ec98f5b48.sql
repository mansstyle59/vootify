-- Allow users to update status on playlists shared TO them
CREATE POLICY "Users can update own shared playlists status"
ON public.shared_playlists
FOR UPDATE
TO authenticated
USING (shared_to = auth.uid())
WITH CHECK (shared_to = auth.uid());

-- Allow users to delete rejected shared playlists
CREATE POLICY "Users can delete rejected shared playlists"
ON public.shared_playlists
FOR DELETE
TO authenticated
USING (shared_to = auth.uid());