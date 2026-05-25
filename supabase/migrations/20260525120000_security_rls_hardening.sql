-- Security hardening: restrict permissive RLS policies to authenticated users
-- and remove overlapping devis_helper policies that bypass role checks.

-- ========== documents / document_lines ==========
DROP POLICY IF EXISTS "Enable read access for all users" ON public.documents;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.documents;
DROP POLICY IF EXISTS "Enable update for all users" ON public.documents;

DROP POLICY IF EXISTS "Enable read for all users lines" ON public.document_lines;
DROP POLICY IF EXISTS "Enable insert for all users lines" ON public.document_lines;
DROP POLICY IF EXISTS "Enable update for all users lines" ON public.document_lines;

CREATE POLICY "documents_select_authenticated"
  ON public.documents FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "documents_insert_authenticated"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "documents_update_authenticated"
  ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "document_lines_select_authenticated"
  ON public.document_lines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "document_lines_insert_authenticated"
  ON public.document_lines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "document_lines_update_authenticated"
  ON public.document_lines FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========== rdvs ==========
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rdvs;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.rdvs;
DROP POLICY IF EXISTS "Enable update for all users" ON public.rdvs;

CREATE POLICY "rdvs_select_authenticated"
  ON public.rdvs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rdvs_insert_authenticated"
  ON public.rdvs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "rdvs_update_authenticated"
  ON public.rdvs FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "rdvs_delete_authenticated"
  ON public.rdvs FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- ========== devis_helper_mappings — drop permissive legacy policies ==========
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.devis_helper_mappings;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.devis_helper_mappings;
DROP POLICY IF EXISTS "Allow authenticated update access" ON public.devis_helper_mappings;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON public.devis_helper_mappings;
