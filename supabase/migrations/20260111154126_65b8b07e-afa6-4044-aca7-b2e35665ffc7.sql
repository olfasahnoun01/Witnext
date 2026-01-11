-- Fix products table: restrict SELECT to admins and moderators only
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;

-- Only admins and moderators can read products (business inventory data)
CREATE POLICY "Admins and moderators can read products" 
ON public.products 
FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role)
);