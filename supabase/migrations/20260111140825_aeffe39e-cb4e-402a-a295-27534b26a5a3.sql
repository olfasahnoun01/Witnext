-- Fix products table: Remove public policies and add authenticated-only policies
DROP POLICY IF EXISTS "Allow public read on products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert on products" ON public.products;
DROP POLICY IF EXISTS "Allow public update on products" ON public.products;
DROP POLICY IF EXISTS "Allow public delete on products" ON public.products;

-- Create authenticated-only policies for products
CREATE POLICY "Authenticated users can read products"
ON public.products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
ON public.products FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also fix fournisseurs table (same issue)
DROP POLICY IF EXISTS "Allow public read on fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "Allow public insert on fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "Allow public update on fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "Allow public delete on fournisseurs" ON public.fournisseurs;

CREATE POLICY "Authenticated users can read fournisseurs"
ON public.fournisseurs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert fournisseurs"
ON public.fournisseurs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update fournisseurs"
ON public.fournisseurs FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete fournisseurs"
ON public.fournisseurs FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also fix transactions table (same issue)
DROP POLICY IF EXISTS "Allow public read on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public insert on transactions" ON public.transactions;

CREATE POLICY "Authenticated users can read transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (true);