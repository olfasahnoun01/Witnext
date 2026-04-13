INSERT INTO storage.buckets (id, name, public) VALUES ('registre_commerce_client', 'registre_commerce_client', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload registre_commerce_client"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'registre_commerce_client');

CREATE POLICY "Authenticated users can view registre_commerce_client"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'registre_commerce_client');

CREATE POLICY "Authenticated users can update registre_commerce_client"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'registre_commerce_client');

CREATE POLICY "Admins and moderators can delete registre_commerce_client"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'registre_commerce_client' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
));
