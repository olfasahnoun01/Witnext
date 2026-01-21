-- Allow regular users to read products (view only)
CREATE POLICY "Users can read products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- Allow regular users to read product_groups (view only)
CREATE POLICY "Users can read product_groups"
ON public.product_groups
FOR SELECT
TO authenticated
USING (true);

-- Drop the restrictive policies and recreate them for admin/moderator only for write operations
-- (The existing SELECT policies for admin/moderator will remain, this adds a broader read policy)