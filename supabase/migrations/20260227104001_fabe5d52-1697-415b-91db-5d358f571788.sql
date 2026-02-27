
-- Drop existing permissive policies for update and delete
DROP POLICY IF EXISTS "All authenticated users can update devis" ON public.devis;
DROP POLICY IF EXISTS "All authenticated users can delete devis" ON public.devis;

-- Admins and moderators can update/delete any devis
CREATE POLICY "Admins and moderators can update any devis"
ON public.devis FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can delete any devis"
ON public.devis FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Users can only update/delete their own devis
CREATE POLICY "Users can update own devis"
ON public.devis FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can delete own devis"
ON public.devis FOR DELETE
TO authenticated
USING (created_by = auth.uid());
