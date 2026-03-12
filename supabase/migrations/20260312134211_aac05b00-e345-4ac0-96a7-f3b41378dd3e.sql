CREATE POLICY "All authenticated users can insert clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (true);