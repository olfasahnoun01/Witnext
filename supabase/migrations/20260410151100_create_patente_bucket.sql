
-- Create storage bucket for client patentes (PRIVATE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patentes_client', 'patentes_client', false)
ON CONFLICT (id) DO NOTHING;

-- Allow ONLY authenticated users to read the patente images
CREATE POLICY "Authenticated read access for patentes"
ON storage.objects FOR SELECT
USING (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to upload new patentes
CREATE POLICY "Authenticated users can upload patentes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update patentes"
ON storage.objects FOR UPDATE
USING (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete patentes
CREATE POLICY "Authenticated users can delete patentes"
ON storage.objects FOR DELETE
USING (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);

-- Add patente_url column to clients table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'patente_url') THEN
        ALTER TABLE public.clients ADD COLUMN patente_url TEXT DEFAULT NULL;
    END IF;
END $$;
