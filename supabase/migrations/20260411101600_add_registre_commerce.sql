
-- 1. Create the bucket for Registre de Commerce (PRIVATE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('registre_commerce_client', 'registre_commerce_client', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies for RC bucket
CREATE POLICY "Lecture sécurisée RC" ON storage.objects
FOR SELECT USING (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);

CREATE POLICY "Upload RC" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);

CREATE POLICY "Modif RC" ON storage.objects
FOR UPDATE USING (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);

CREATE POLICY "Suppression RC" ON storage.objects
FOR DELETE USING (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);

-- 3. Add registre_commerce_url column to clients table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'registre_commerce_url') THEN
        ALTER TABLE public.clients ADD COLUMN registre_commerce_url TEXT DEFAULT NULL;
    END IF;
END $$;
