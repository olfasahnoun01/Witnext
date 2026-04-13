
-- Add is_ba column to devis table
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS is_ba boolean NOT NULL DEFAULT false;

-- Add registre_commerce_url column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registre_commerce_url text;

-- Create storage bucket for registre de commerce
INSERT INTO storage.buckets (id, name, public)
VALUES ('registre_commerce', 'registre_commerce', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for registre_commerce bucket
CREATE POLICY "Authenticated users can upload registre_commerce"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'registre_commerce');

CREATE POLICY "Authenticated users can view registre_commerce"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'registre_commerce');

CREATE POLICY "Admins and moderators can delete registre_commerce"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'registre_commerce' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
));

CREATE POLICY "Authenticated users can update registre_commerce"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'registre_commerce');
