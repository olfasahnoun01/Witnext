-- Gallery commercial: legacy flat paths + private bucket (signed URLs in webapp).

UPDATE storage.buckets SET public = false WHERE id = 'gallery-photos';

-- Pre-company-prefix uploads (flat filenames) remain readable for commercial users.
DROP POLICY IF EXISTS gallery_photos_legacy_flat_select ON storage.objects;
CREATE POLICY gallery_photos_legacy_flat_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gallery-photos'
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
    AND public.storage_object_company_prefix(name) IS NULL
  );
