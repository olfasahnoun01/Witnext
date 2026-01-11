-- Drop overly permissive policies for products
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;

-- Create role-restricted policies for products (matching transactions pattern)
CREATE POLICY "Admins and moderators can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Admins and moderators can update products"
ON public.products FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);