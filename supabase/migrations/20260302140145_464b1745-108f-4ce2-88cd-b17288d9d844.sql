
-- Drop restrictive policies on gallery_items
DROP POLICY IF EXISTS "Admins and mods can delete gallery" ON public.gallery_items;
DROP POLICY IF EXISTS "Admins and mods can insert gallery" ON public.gallery_items;
DROP POLICY IF EXISTS "Admins and mods can update gallery" ON public.gallery_items;

-- Create open policies for all authenticated users
CREATE POLICY "All authenticated can insert gallery" ON public.gallery_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated can update gallery" ON public.gallery_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All authenticated can delete gallery" ON public.gallery_items FOR DELETE TO authenticated USING (true);

-- Drop restrictive policies on gallery_categories
DROP POLICY IF EXISTS "Admins and mods can delete gallery categories" ON public.gallery_categories;
DROP POLICY IF EXISTS "Admins and mods can insert gallery categories" ON public.gallery_categories;
DROP POLICY IF EXISTS "Admins and mods can update gallery categories" ON public.gallery_categories;

-- Create open policies for all authenticated users
CREATE POLICY "All authenticated can insert gallery categories" ON public.gallery_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated can update gallery categories" ON public.gallery_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All authenticated can delete gallery categories" ON public.gallery_categories FOR DELETE TO authenticated USING (true);
