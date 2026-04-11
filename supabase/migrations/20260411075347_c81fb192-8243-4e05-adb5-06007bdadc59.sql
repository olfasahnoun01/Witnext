
-- Add patente_url column to clients
ALTER TABLE public.clients ADD COLUMN patente_url text;

-- Create storage bucket for patentes
INSERT INTO storage.buckets (id, name, public) VALUES ('patentes_client', 'patentes_client', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload patentes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patentes_client');

CREATE POLICY "Authenticated users can view patentes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patentes_client');

CREATE POLICY "Authenticated users can delete patentes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patentes_client');
