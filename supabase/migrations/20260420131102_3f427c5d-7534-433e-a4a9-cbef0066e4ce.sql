
-- Remove unrestricted INSERT policies (role-based ones remain)
DROP POLICY IF EXISTS "All users can insert products" ON public.products;
DROP POLICY IF EXISTS "All users can insert product_groups" ON public.product_groups;
DROP POLICY IF EXISTS "All users can insert product_group_fournisseurs" ON public.product_group_fournisseurs;
DROP POLICY IF EXISTS "All authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "All authenticated users can read clients" ON public.clients;
