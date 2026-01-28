-- Update product_groups RLS: Allow moderators to delete product groups
DROP POLICY IF EXISTS "Admins can delete product_groups" ON public.product_groups;
CREATE POLICY "Admins and moderators can delete product_groups"
ON public.product_groups
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));