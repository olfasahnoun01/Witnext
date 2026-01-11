-- Fix fournisseurs INSERT policy: restrict to admins and moderators
DROP POLICY IF EXISTS "Authenticated users can insert fournisseurs" ON public.fournisseurs;

CREATE POLICY "Admins and moderators can insert fournisseurs" 
ON public.fournisseurs 
FOR INSERT 
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role)
);

-- Fix fournisseurs UPDATE policy: restrict to admins and moderators
DROP POLICY IF EXISTS "Authenticated users can update fournisseurs" ON public.fournisseurs;

CREATE POLICY "Admins and moderators can update fournisseurs" 
ON public.fournisseurs 
FOR UPDATE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role)
);