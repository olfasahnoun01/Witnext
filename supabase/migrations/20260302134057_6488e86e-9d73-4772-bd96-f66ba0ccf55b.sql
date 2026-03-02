
-- Gallery items table (completely independent)
CREATE TABLE public.gallery_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Général',
  description TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "All authenticated can read gallery" ON public.gallery_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins and moderators can insert/update/delete
CREATE POLICY "Admins and mods can insert gallery" ON public.gallery_items
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and mods can update gallery" ON public.gallery_items
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and mods can delete gallery" ON public.gallery_items
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Storage bucket for gallery photos
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery-photos', 'gallery-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view gallery photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'gallery-photos');

CREATE POLICY "Auth users can upload gallery photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gallery-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete gallery photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'gallery-photos' AND auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_items;
