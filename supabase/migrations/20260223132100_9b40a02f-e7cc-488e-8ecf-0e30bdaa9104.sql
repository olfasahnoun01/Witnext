
-- Drop the overly permissive policy
DROP POLICY "All authenticated users can update devis" ON public.devis;

-- Replace with proper scoped policy
CREATE POLICY "All authenticated users can update own devis"
ON public.devis
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));
