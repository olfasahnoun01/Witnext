
-- 1. Fournisseurs: restrict public read to authenticated
DROP POLICY IF EXISTS "All authenticated users can read fournisseurs" ON public.fournisseurs;
CREATE POLICY "Authenticated users can read fournisseurs"
ON public.fournisseurs FOR SELECT TO authenticated USING (true);

-- 2. Transactions: drop unrestricted insert
DROP POLICY IF EXISTS "All users can insert transactions" ON public.transactions;

-- 3. Devis: replace unrestricted insert with ownership check
DROP POLICY IF EXISTS "All authenticated users can insert devis" ON public.devis;
CREATE POLICY "Authenticated users can insert own devis"
ON public.devis FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- 4. Bons_commande: replace unrestricted insert with ownership check
DROP POLICY IF EXISTS "All authenticated users can insert bons_commande" ON public.bons_commande;
CREATE POLICY "Authenticated users can insert own bons_commande"
ON public.bons_commande FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- 5. Echantillons: tighten CRUD - link via parent devis ownership
DROP POLICY IF EXISTS "Authenticated users can insert echantillons" ON public.echantillons;
DROP POLICY IF EXISTS "Authenticated users can update echantillons" ON public.echantillons;
DROP POLICY IF EXISTS "Authenticated users can delete echantillons" ON public.echantillons;

CREATE POLICY "Users can insert echantillons for own devis"
ON public.echantillons FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = echantillons.devis_id
      AND (d.created_by = auth.uid()
           OR has_role(auth.uid(), 'admin'::app_role)
           OR has_role(auth.uid(), 'moderator'::app_role))
  )
);

CREATE POLICY "Users can update echantillons for own devis"
ON public.echantillons FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = echantillons.devis_id
      AND (d.created_by = auth.uid()
           OR has_role(auth.uid(), 'admin'::app_role)
           OR has_role(auth.uid(), 'moderator'::app_role))
  )
);

CREATE POLICY "Users can delete echantillons for own devis"
ON public.echantillons FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = echantillons.devis_id
      AND (d.created_by = auth.uid()
           OR has_role(auth.uid(), 'admin'::app_role)
           OR has_role(auth.uid(), 'moderator'::app_role))
  )
);

-- 6. Gallery items/categories: restrict mutations to admins/moderators
DROP POLICY IF EXISTS "All authenticated can insert gallery" ON public.gallery_items;
DROP POLICY IF EXISTS "All authenticated can update gallery" ON public.gallery_items;
DROP POLICY IF EXISTS "All authenticated can delete gallery" ON public.gallery_items;

CREATE POLICY "Users can insert own gallery items"
ON public.gallery_items FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own gallery items or admins"
ON public.gallery_items FOR UPDATE TO authenticated
USING (created_by = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can delete own gallery items or admins"
ON public.gallery_items FOR DELETE TO authenticated
USING (created_by = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "All authenticated can insert gallery categories" ON public.gallery_categories;
DROP POLICY IF EXISTS "All authenticated can update gallery categories" ON public.gallery_categories;
DROP POLICY IF EXISTS "All authenticated can delete gallery categories" ON public.gallery_categories;

CREATE POLICY "Admins/mods can insert gallery categories"
ON public.gallery_categories FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins/mods can update gallery categories"
ON public.gallery_categories FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins/mods can delete gallery categories"
ON public.gallery_categories FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- 7. Tighten update_product_fiche_technique function
CREATE OR REPLACE FUNCTION public.update_product_fiche_technique(_product_id integer, _fiche_technique_url text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE products
  SET fiche_technique_url = NULLIF(_fiche_technique_url, ''),
      updated_at = now()
  WHERE id = _product_id;
END;
$function$;

-- 8. Make fiches-techniques bucket private and require auth on read
UPDATE storage.buckets SET public = false WHERE id = 'fiches-techniques';

DROP POLICY IF EXISTS "Public can read fiches-techniques" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read fiches-techniques" ON storage.objects;
DROP POLICY IF EXISTS "fiches-techniques public read" ON storage.objects;

CREATE POLICY "Authenticated can read fiches-techniques"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fiches-techniques');

CREATE POLICY "Authenticated can upload fiches-techniques"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fiches-techniques');

CREATE POLICY "Authenticated can update fiches-techniques"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'fiches-techniques');

CREATE POLICY "Authenticated can delete fiches-techniques"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fiches-techniques');
