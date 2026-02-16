
-- Drop the restrictive SELECT policy
DROP POLICY "Users can read own devis" ON public.devis;

-- Allow all authenticated users to read all devis
CREATE POLICY "All authenticated users can read devis"
ON public.devis
FOR SELECT
TO authenticated
USING (true);
