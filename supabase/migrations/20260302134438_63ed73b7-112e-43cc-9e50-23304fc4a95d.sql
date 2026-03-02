
CREATE TABLE public.gallery_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read gallery categories" ON public.gallery_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and mods can insert gallery categories" ON public.gallery_categories
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and mods can update gallery categories" ON public.gallery_categories
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and mods can delete gallery categories" ON public.gallery_categories
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Seed default categories
INSERT INTO public.gallery_categories (name) VALUES
  ('Général'), ('Produits'), ('Projets'), ('Installations'), ('Autres');

ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_categories;
