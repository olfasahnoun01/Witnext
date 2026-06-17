-- Follow-up: child-table section RLS + hr-contracts storage company prefix.

-- ---------------------------------------------------------------------------
-- Child operational tables: inherit parent company + section gate
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.document_lines') IS NOT NULL THEN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='document_lines' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.document_lines', r.policyname);
    END LOOP;
    ALTER TABLE public.document_lines ENABLE ROW LEVEL SECURITY;
    CREATE POLICY document_lines_sec_select ON public.document_lines FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_lines.document_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats','magasin']::text[])
      ));
    CREATE POLICY document_lines_sec_insert ON public.document_lines FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_lines.document_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats','magasin']::text[])
      ));
    CREATE POLICY document_lines_sec_update ON public.document_lines FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_lines.document_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats','magasin']::text[])
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_lines.document_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats','magasin']::text[])
      ));
    CREATE POLICY document_lines_sec_delete ON public.document_lines FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_lines.document_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats','magasin']::text[])
      ));
  END IF;

  IF to_regclass('public.echantillons') IS NOT NULL THEN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='echantillons' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.echantillons', r.policyname);
    END LOOP;
    ALTER TABLE public.echantillons ENABLE ROW LEVEL SECURITY;
    CREATE POLICY echantillons_sec_select ON public.echantillons FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.devis d
        WHERE d.id = echantillons.devis_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats']::text[])
      ));
    CREATE POLICY echantillons_sec_insert ON public.echantillons FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.devis d
        WHERE d.id = echantillons.devis_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats']::text[])
      ));
    CREATE POLICY echantillons_sec_update ON public.echantillons FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.devis d
        WHERE d.id = echantillons.devis_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats']::text[])
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.devis d
        WHERE d.id = echantillons.devis_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats']::text[])
      ));
    CREATE POLICY echantillons_sec_delete ON public.echantillons FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.devis d
        WHERE d.id = echantillons.devis_id
          AND d.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['ventes','achats']::text[])
      ));
  END IF;

  IF to_regclass('public.product_group_fournisseurs') IS NOT NULL THEN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='product_group_fournisseurs' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_group_fournisseurs', r.policyname);
    END LOOP;
    ALTER TABLE public.product_group_fournisseurs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY pgf_sec_select ON public.product_group_fournisseurs FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.product_groups pg
        WHERE pg.id = product_group_fournisseurs.product_group_id
          AND pg.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['magasin']::text[])
      ));
    CREATE POLICY pgf_sec_insert ON public.product_group_fournisseurs FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.product_groups pg
        WHERE pg.id = product_group_fournisseurs.product_group_id
          AND pg.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['magasin']::text[])
      ));
    CREATE POLICY pgf_sec_update ON public.product_group_fournisseurs FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.product_groups pg
        WHERE pg.id = product_group_fournisseurs.product_group_id
          AND pg.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['magasin']::text[])
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.product_groups pg
        WHERE pg.id = product_group_fournisseurs.product_group_id
          AND pg.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['magasin']::text[])
      ));
    CREATE POLICY pgf_sec_delete ON public.product_group_fournisseurs FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.product_groups pg
        WHERE pg.id = product_group_fournisseurs.product_group_id
          AND pg.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['magasin']::text[])
      ));
  END IF;
END $$;

-- HR child tables: require rh section via parent employee
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.hr_employee_leaves') IS NOT NULL THEN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hr_employee_leaves' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.hr_employee_leaves', r.policyname);
    END LOOP;
    ALTER TABLE public.hr_employee_leaves ENABLE ROW LEVEL SECURITY;
    CREATE POLICY hr_leaves_sec_all ON public.hr_employee_leaves FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.hr_employees e
        WHERE e.id = hr_employee_leaves.employee_id
          AND e.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['rh']::text[])
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.hr_employees e
        WHERE e.id = hr_employee_leaves.employee_id
          AND e.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['rh']::text[])
      ));
  END IF;

  IF to_regclass('public.hr_payroll_movements') IS NOT NULL THEN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hr_payroll_movements' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.hr_payroll_movements', r.policyname);
    END LOOP;
    ALTER TABLE public.hr_payroll_movements ENABLE ROW LEVEL SECURITY;
    CREATE POLICY hr_movements_sec_all ON public.hr_payroll_movements FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.hr_employees e
        WHERE e.id = hr_payroll_movements.employee_id
          AND e.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['rh']::text[])
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.hr_employees e
        WHERE e.id = hr_payroll_movements.employee_id
          AND e.company_id IN (SELECT public.user_company_ids())
          AND public.user_has_any_app_section(ARRAY['rh']::text[])
      ));
  END IF;
END $$;

-- hr-contracts storage bucket
DROP POLICY IF EXISTS hr_contracts_select ON storage.objects;
DROP POLICY IF EXISTS hr_contracts_insert ON storage.objects;
DROP POLICY IF EXISTS hr_contracts_update ON storage.objects;
DROP POLICY IF EXISTS hr_contracts_delete ON storage.objects;

CREATE POLICY hr_contracts_select_sec ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'hr-contracts'
    AND public.user_has_app_section('rh')
    AND public.storage_path_readable(name)
  );
CREATE POLICY hr_contracts_insert_sec ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hr-contracts'
    AND public.user_has_app_section('rh')
    AND public.storage_path_writable(name)
  );
CREATE POLICY hr_contracts_update_sec ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'hr-contracts'
    AND public.user_has_app_section('rh')
    AND public.storage_path_readable(name)
  )
  WITH CHECK (
    bucket_id = 'hr-contracts'
    AND public.user_has_app_section('rh')
    AND public.storage_path_writable(name)
  );
CREATE POLICY hr_contracts_delete_sec ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'hr-contracts'
    AND public.storage_path_readable(name)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

-- rh-report-files storage bucket
DROP POLICY IF EXISTS rh_report_files_select ON storage.objects;
DROP POLICY IF EXISTS rh_report_files_insert ON storage.objects;
DROP POLICY IF EXISTS rh_report_files_update ON storage.objects;
DROP POLICY IF EXISTS rh_report_files_delete ON storage.objects;

CREATE POLICY rh_report_files_select_sec ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rh-report-files'
    AND public.user_has_app_section('rh')
    AND public.storage_path_readable(name)
  );
CREATE POLICY rh_report_files_insert_sec ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rh-report-files'
    AND public.user_has_app_section('rh')
    AND public.storage_path_writable(name)
  );
CREATE POLICY rh_report_files_update_sec ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rh-report-files'
    AND public.user_has_app_section('rh')
    AND public.storage_path_readable(name)
  )
  WITH CHECK (
    bucket_id = 'rh-report-files'
    AND public.user_has_app_section('rh')
    AND public.storage_path_writable(name)
  );
CREATE POLICY rh_report_files_delete_sec ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rh-report-files'
    AND public.storage_path_readable(name)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
