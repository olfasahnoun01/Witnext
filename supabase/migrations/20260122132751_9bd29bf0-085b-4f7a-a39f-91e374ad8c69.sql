-- Update documents RLS policies to allow moderators to edit and delete

-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;

-- Create new policies for admins AND moderators
CREATE POLICY "Admins and moderators can update documents"
ON public.documents FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can delete documents"
ON public.documents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));