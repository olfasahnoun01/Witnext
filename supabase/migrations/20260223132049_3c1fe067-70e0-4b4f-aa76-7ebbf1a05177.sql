
-- Allow users to delete their own devis
CREATE POLICY "Users can delete own devis"
ON public.devis
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Allow all authenticated users to update devis (not just admin/mod)
CREATE POLICY "All authenticated users can update devis"
ON public.devis
FOR UPDATE
TO authenticated
USING (true);
