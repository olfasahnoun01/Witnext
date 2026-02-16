
-- Create storage bucket for fiches techniques
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiches-techniques', 'fiches-techniques', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload fiches techniques
CREATE POLICY "Authenticated users can upload fiches techniques"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'fiches-techniques' AND auth.uid() IS NOT NULL);

-- Allow public read access
CREATE POLICY "Public read access for fiches techniques"
ON storage.objects FOR SELECT
USING (bucket_id = 'fiches-techniques');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update fiches techniques"
ON storage.objects FOR UPDATE
USING (bucket_id = 'fiches-techniques' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete fiches techniques
CREATE POLICY "Authenticated users can delete fiches techniques"
ON storage.objects FOR DELETE
USING (bucket_id = 'fiches-techniques' AND auth.uid() IS NOT NULL);

-- Add fiche_technique_url column to product_group_fournisseurs
ALTER TABLE public.product_group_fournisseurs
ADD COLUMN fiche_technique_url text DEFAULT NULL;
