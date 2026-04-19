
-- 1) devis_helper_mappings (referenced by DevisHelper.tsx)
CREATE TABLE IF NOT EXISTS public.devis_helper_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extracted_name text NOT NULL UNIQUE,
  fiche_technique_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devis_helper_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mappings"
  ON public.devis_helper_mappings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Mods/admins can insert mappings"
  ON public.devis_helper_mappings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role));

CREATE POLICY "Mods/admins can update mappings"
  ON public.devis_helper_mappings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role));

CREATE POLICY "Admins can delete mappings"
  ON public.devis_helper_mappings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_devis_helper_mappings_updated
  BEFORE UPDATE ON public.devis_helper_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) user_section_permissions (new permissions layer)
CREATE TABLE IF NOT EXISTS public.user_section_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  section_key text NOT NULL,
  subsection_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section_key, subsection_key)
);

CREATE INDEX IF NOT EXISTS idx_user_section_permissions_user
  ON public.user_section_permissions(user_id);

ALTER TABLE public.user_section_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own permissions"
  ON public.user_section_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins can insert permissions"
  ON public.user_section_permissions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins can update permissions"
  ON public.user_section_permissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins can delete permissions"
  ON public.user_section_permissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));


-- 3) Auto-grant existing non-admin users full access to "magasin" big section
INSERT INTO public.user_section_permissions (user_id, section_key, subsection_key)
SELECT p.user_id, 'magasin', ''
FROM public.profiles p
WHERE NOT public.has_role(p.user_id, 'admin'::app_role)
ON CONFLICT (user_id, section_key, subsection_key) DO NOTHING;
