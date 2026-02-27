-- Allow all authenticated users to insert product_groups (for devis article creation)
CREATE POLICY "All users can insert product_groups"
ON public.product_groups FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to insert products (variants)
CREATE POLICY "All users can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to insert product_group_fournisseurs
CREATE POLICY "All users can insert product_group_fournisseurs"
ON public.product_group_fournisseurs FOR INSERT
TO authenticated
WITH CHECK (true);
