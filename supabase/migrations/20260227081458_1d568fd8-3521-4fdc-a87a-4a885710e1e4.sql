
DROP POLICY "Admins and moderators can update devis" ON public.devis;
DROP POLICY "All authenticated users can update own devis" ON public.devis;
DROP POLICY "Users can update own devis" ON public.devis;

CREATE POLICY "All authenticated users can update devis"
  ON public.devis FOR UPDATE
  USING (true);
