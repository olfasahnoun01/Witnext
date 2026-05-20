-- Private client/product document buckets with authenticated access (fixes blank PDF preview).

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('client-documents', 'client-documents', false),
  ('product-documents', 'product-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated can read client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete client-documents" ON storage.objects;

CREATE POLICY "Authenticated can read client-documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents');

CREATE POLICY "Authenticated can upload client-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "Authenticated can update client-documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-documents');

CREATE POLICY "Authenticated can delete client-documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-documents');

DROP POLICY IF EXISTS "Authenticated can read product-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload product-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update product-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete product-documents" ON storage.objects;

CREATE POLICY "Authenticated can read product-documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-documents');

CREATE POLICY "Authenticated can upload product-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-documents');

CREATE POLICY "Authenticated can update product-documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-documents');

CREATE POLICY "Authenticated can delete product-documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-documents');
