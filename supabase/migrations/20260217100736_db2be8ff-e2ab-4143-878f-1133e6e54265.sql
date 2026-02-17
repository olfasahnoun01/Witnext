CREATE POLICY "All authenticated users can read clients"
ON public.clients
FOR SELECT
TO authenticated
USING (true);