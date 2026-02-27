
-- Drop existing restrictive policies on devis
DROP POLICY IF EXISTS "Admins and moderators can delete devis" ON public.devis;
DROP POLICY IF EXISTS "Users can delete own devis" ON public.devis;
DROP POLICY IF EXISTS "All authenticated users can read devis" ON public.devis;
DROP POLICY IF EXISTS "All authenticated users can update devis" ON public.devis;
DROP POLICY IF EXISTS "Users can create devis" ON public.devis;

-- Create open policies for all authenticated users
CREATE POLICY "All authenticated users can read devis"
ON public.devis FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can insert devis"
ON public.devis FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "All authenticated users can update devis"
ON public.devis FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can delete devis"
ON public.devis FOR DELETE
TO authenticated
USING (true);
