CREATE POLICY "All authenticated users can read fournisseurs"
  ON public.fournisseurs FOR SELECT
  USING (true);