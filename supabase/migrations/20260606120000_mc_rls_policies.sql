-- =============================================================================
-- MULTI-COMPANY: strict company-scoped RLS (Phase 3)
--
--   * Ungated operational tables    -> pure company-scoped CRUD.
--   * Role/section-gated tables      -> existing gate ANDed with company scope.
--   * Pure line/child tables         -> isolated via parent EXISTS().
--   * clients/fournisseurs           -> hybrid "Grosafe-open" converted to STRICT.
--
-- Depends on helpers from 20260606100000 and columns from 20260606110000.
-- Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ungated operational tables: pure company-scoped CRUD.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'products', 'product_groups', 'transactions', 'orders',
    'devis', 'bons_commande', 'documents', 'gallery_items', 'rdvs',
    'fuel_cards', 'maintenance', 'vehicle_charges',
    'plannings', 'employees'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    PERFORM public.mc_apply_company_rls(t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. clients / fournisseurs: convert hybrid (Grosafe-open) -> STRICT.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'fournisseurs'] LOOP
    PERFORM public.mc_apply_company_rls(t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Role/section-gated tables: keep the gate, AND company scope.
-- -----------------------------------------------------------------------------

-- factures: read = any member; mutate = staff + member ----------------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.factures') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='factures' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.factures', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY factures_mc_select ON public.factures FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.user_company_ids()));
CREATE POLICY factures_mc_insert ON public.factures FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );
CREATE POLICY factures_mc_update ON public.factures FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  )
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );
CREATE POLICY factures_mc_delete ON public.factures FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );

-- vehicles: read/insert = member; update = staff + member; delete = staff + member
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.vehicles') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vehicles', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_mc_select ON public.vehicles FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.user_company_ids()));
CREATE POLICY vehicles_mc_insert ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));
CREATE POLICY vehicles_mc_update ON public.vehicles FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  )
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );
CREATE POLICY vehicles_mc_delete ON public.vehicles FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );

-- fuel_vouchers: read/insert = member; update = staff|driver + member; delete = admin + member
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.fuel_vouchers') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='fuel_vouchers' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fuel_vouchers', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.fuel_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY fuel_vouchers_mc_select ON public.fuel_vouchers FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.user_company_ids()));
CREATE POLICY fuel_vouchers_mc_insert ON public.fuel_vouchers FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));
CREATE POLICY fuel_vouchers_mc_update ON public.fuel_vouchers FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      OR conducteur_id IN (SELECT public.current_employee_ids())
    )
  )
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      OR conducteur_id IN (SELECT public.current_employee_ids())
    )
  );
CREATE POLICY fuel_vouchers_mc_delete ON public.fuel_vouchers FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- vehicle_reminders: read = member; mutate = staff + member -----------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.vehicle_reminders') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='vehicle_reminders' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vehicle_reminders', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.vehicle_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_reminders_mc_select ON public.vehicle_reminders FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.user_company_ids()));
CREATE POLICY vehicle_reminders_mc_insert ON public.vehicle_reminders FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );
CREATE POLICY vehicle_reminders_mc_update ON public.vehicle_reminders FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  )
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );
CREATE POLICY vehicle_reminders_mc_delete ON public.vehicle_reminders FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );

-- rh_security_reports: section rh + member; delete = staff + member ---------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.rh_security_reports') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='rh_security_reports' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.rh_security_reports', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.rh_security_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_security_reports_mc_select ON public.rh_security_reports FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
CREATE POLICY rh_security_reports_mc_insert ON public.rh_security_reports FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
CREATE POLICY rh_security_reports_mc_update ON public.rh_security_reports FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  )
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
CREATE POLICY rh_security_reports_mc_delete ON public.rh_security_reports FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );

-- hr_employees: section rh + member; delete = staff + member ----------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.hr_employees') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hr_employees' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hr_employees', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_employees_mc_select ON public.hr_employees FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
CREATE POLICY hr_employees_mc_insert ON public.hr_employees FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
CREATE POLICY hr_employees_mc_update ON public.hr_employees FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  )
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
CREATE POLICY hr_employees_mc_delete ON public.hr_employees FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );

-- -----------------------------------------------------------------------------
-- 4. Pure line/child tables: isolate via parent's company_id (EXISTS).
-- -----------------------------------------------------------------------------

-- document_lines -> documents -----------------------------------------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.document_lines') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='document_lines' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.document_lines', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.document_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_lines_mc_select ON public.document_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_lines.document_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY document_lines_mc_insert ON public.document_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_lines.document_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY document_lines_mc_update ON public.document_lines FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_lines.document_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_lines.document_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY document_lines_mc_delete ON public.document_lines FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_lines.document_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ));

-- echantillons -> devis ------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.echantillons') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='echantillons' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.echantillons', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.echantillons ENABLE ROW LEVEL SECURITY;

CREATE POLICY echantillons_mc_select ON public.echantillons FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = echantillons.devis_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY echantillons_mc_insert ON public.echantillons FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = echantillons.devis_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY echantillons_mc_update ON public.echantillons FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = echantillons.devis_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = echantillons.devis_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY echantillons_mc_delete ON public.echantillons FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = echantillons.devis_id
      AND d.company_id IN (SELECT public.user_company_ids())
  ));

-- product_group_fournisseurs -> product_groups ------------------------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.product_group_fournisseurs') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='product_group_fournisseurs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_group_fournisseurs', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.product_group_fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pgf_mc_select ON public.product_group_fournisseurs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_groups pg
    WHERE pg.id = product_group_fournisseurs.product_group_id
      AND pg.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY pgf_mc_insert ON public.product_group_fournisseurs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_groups pg
    WHERE pg.id = product_group_fournisseurs.product_group_id
      AND pg.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY pgf_mc_update ON public.product_group_fournisseurs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_groups pg
    WHERE pg.id = product_group_fournisseurs.product_group_id
      AND pg.company_id IN (SELECT public.user_company_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_groups pg
    WHERE pg.id = product_group_fournisseurs.product_group_id
      AND pg.company_id IN (SELECT public.user_company_ids())
  ));
CREATE POLICY pgf_mc_delete ON public.product_group_fournisseurs FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_groups pg
    WHERE pg.id = product_group_fournisseurs.product_group_id
      AND pg.company_id IN (SELECT public.user_company_ids())
  ));

-- hr_employee_leaves -> hr_employees (+ rh section) -------------------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.hr_employee_leaves') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hr_employee_leaves' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hr_employee_leaves', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.hr_employee_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_leaves_mc_all ON public.hr_employee_leaves FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_leaves.employee_id
      AND e.company_id IN (SELECT public.user_company_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_leaves.employee_id
      AND e.company_id IN (SELECT public.user_company_ids())
  ));

-- hr_payroll_movements -> hr_employees -------------------------------------
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.hr_payroll_movements') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hr_payroll_movements' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hr_payroll_movements', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.hr_payroll_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_movements_mc_all ON public.hr_payroll_movements FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_payroll_movements.employee_id
      AND e.company_id IN (SELECT public.user_company_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_payroll_movements.employee_id
      AND e.company_id IN (SELECT public.user_company_ids())
  ));
