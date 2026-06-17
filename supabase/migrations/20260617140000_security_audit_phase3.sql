-- Security audit phase 3: section-aware RLS, storage company paths, RPC hardening.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_any_app_section(p_section_keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_section_permissions usp
      WHERE usp.user_id = auth.uid()
        AND usp.section_key = ANY (p_section_keys)
    );
$$;

REVOKE ALL ON FUNCTION public.user_has_any_app_section(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_any_app_section(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_company_access(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_company_id IN (SELECT public.user_company_ids())
    AND public.user_has_app_section('finance');
$$;

REVOKE ALL ON FUNCTION public.finance_company_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_company_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.storage_object_company_prefix(p_object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
BEGIN
  v_prefix := (string_to_array(trim(both '/' from coalesce(p_object_name, '')), '/'))[1];
  IF v_prefix IS NULL OR v_prefix = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_prefix::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_object_company_prefix(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_object_company_prefix(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.storage_path_readable(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.storage_object_company_prefix(p_object_name) IS NOT NULL THEN
      public.storage_object_company_prefix(p_object_name) IN (SELECT public.user_company_ids())
    ELSE
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  END;
$$;

REVOKE ALL ON FUNCTION public.storage_path_readable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_path_readable(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.storage_path_writable(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.storage_object_company_prefix(p_object_name) IS NOT NULL
    AND public.storage_object_company_prefix(p_object_name) IN (SELECT public.user_company_ids());
$$;

REVOKE ALL ON FUNCTION public.storage_path_writable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_path_writable(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mc_apply_company_section_rls(
  p_table text,
  p_section_keys text[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  gate text;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RAISE NOTICE 'mc_apply_company_section_rls: skip %', p_table;
    RETURN;
  END IF;

  gate := format(
    'company_id IN (SELECT public.user_company_ids()) AND public.user_has_any_app_section(%L::text[])',
    p_section_keys
  );

  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, p_table);
  END LOOP;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);

  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
    p_table || '_sec_select', p_table, gate
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
    p_table || '_sec_insert', p_table, gate
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
    p_table || '_sec_update', p_table, gate, gate
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
    p_table || '_sec_delete', p_table, gate
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- C1: Section-aware RLS on operational tables (UI permissions enforced server-side)
-- ---------------------------------------------------------------------------
SELECT public.mc_apply_company_section_rls('products', ARRAY['magasin']);
SELECT public.mc_apply_company_section_rls('product_groups', ARRAY['magasin']);
SELECT public.mc_apply_company_section_rls('transactions', ARRAY['magasin']);
SELECT public.mc_apply_company_section_rls('orders', ARRAY['magasin']);
SELECT public.mc_apply_company_section_rls('devis', ARRAY['ventes', 'achats']);
SELECT public.mc_apply_company_section_rls('bons_commande', ARRAY['ventes', 'achats']);
SELECT public.mc_apply_company_section_rls('documents', ARRAY['ventes', 'achats', 'magasin']);
SELECT public.mc_apply_company_section_rls('gallery_items', ARRAY['commercial', 'ventes']);
SELECT public.mc_apply_company_section_rls('rdvs', ARRAY['commercial', 'ventes']);
SELECT public.mc_apply_company_section_rls('clients', ARRAY['ventes']);
SELECT public.mc_apply_company_section_rls('fournisseurs', ARRAY['achats']);
SELECT public.mc_apply_company_section_rls('employees', ARRAY['rh']);
SELECT public.mc_apply_company_section_rls('plannings', ARRAY['rh']);
SELECT public.mc_apply_company_section_rls('fuel_cards', ARRAY['vehicules']);
SELECT public.mc_apply_company_section_rls('maintenance', ARRAY['vehicules']);
SELECT public.mc_apply_company_section_rls('vehicle_charges', ARRAY['vehicules']);

-- factures (ERP vente)
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.factures') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='factures' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.factures', r.policyname);
  END LOOP;
  ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
  EXECUTE $p$
    CREATE POLICY factures_sec_select ON public.factures FOR SELECT TO authenticated
    USING (
      company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['ventes']::text[])
    )
  $p$;
  EXECUTE $p$
    CREATE POLICY factures_sec_insert ON public.factures FOR INSERT TO authenticated
    WITH CHECK (
      company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['ventes']::text[])
      AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
    )
  $p$;
  EXECUTE $p$
    CREATE POLICY factures_sec_update ON public.factures FOR UPDATE TO authenticated
    USING (
      company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['ventes']::text[])
      AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
    )
    WITH CHECK (
      company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['ventes']::text[])
      AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
    )
  $p$;
  EXECUTE $p$
    CREATE POLICY factures_sec_delete ON public.factures FOR DELETE TO authenticated
    USING (
      company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['ventes']::text[])
      AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
    )
  $p$;
END $$;

-- vehicles / fuel_vouchers: add vehicules section gate
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.vehicles') IS NOT NULL THEN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.vehicles', r.policyname);
    END LOOP;
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY vehicles_sec_select ON public.vehicles FOR SELECT TO authenticated
      USING (
        company_id IN (SELECT public.user_company_ids())
        AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
      );
    CREATE POLICY vehicles_sec_insert ON public.vehicles FOR INSERT TO authenticated
      WITH CHECK (
        company_id IN (SELECT public.user_company_ids())
        AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
      );
    CREATE POLICY vehicles_sec_update ON public.vehicles FOR UPDATE TO authenticated
      USING (
        company_id IN (SELECT public.user_company_ids())
        AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
        AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
      )
      WITH CHECK (
        company_id IN (SELECT public.user_company_ids())
        AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
        AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
      );
    CREATE POLICY vehicles_sec_delete ON public.vehicles FOR DELETE TO authenticated
      USING (
        company_id IN (SELECT public.user_company_ids())
        AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
        AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
      );
  END IF;
END $$;

-- Finance tables with direct company_id (explicit policy names from prior migrations)
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('invoices', 'invoices'),
      ('payments', 'payments'),
      ('journal_entries', 'je'),
      ('tax_declarations', 'tax'),
      ('treasury_movements', 'treasury')
    ) AS v(tbl, prefix)
  LOOP
    IF to_regclass('public.' || rec.tbl) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.prefix || '_select_finance', rec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.prefix || '_insert_finance', rec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.prefix || '_update_finance', rec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.prefix || '_delete_finance', rec.tbl);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rec.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.finance_company_access(company_id))',
      rec.prefix || '_select_finance', rec.tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.finance_company_access(company_id))',
      rec.prefix || '_insert_finance', rec.tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.finance_company_access(company_id)) WITH CHECK (public.finance_company_access(company_id))',
      rec.prefix || '_update_finance', rec.tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.finance_company_access(company_id))',
      rec.prefix || '_delete_finance', rec.tbl
    );
  END LOOP;
END $$;

-- Treasury module tables (policies named {table}_select without _finance suffix)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'treasury_accounts', 'treasury_transfers', 'finance_avoirs', 'finance_avoirs_article',
    'withholding_certificates', 'bank_fee_types', 'bank_fees', 'bank_statement_lines'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.finance_company_access(company_id))',
      t || '_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.finance_company_access(company_id))',
      t || '_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.finance_company_access(company_id)) WITH CHECK (public.finance_company_access(company_id))',
      t || '_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.finance_company_access(company_id))',
      t || '_delete', t
    );
  END LOOP;
END $$;

-- Child finance tables (access via parent + finance section)
DO $$
BEGIN
  IF to_regclass('public.invoice_lines') IS NOT NULL THEN
    DROP POLICY IF EXISTS invoice_lines_select_finance ON public.invoice_lines;
    DROP POLICY IF EXISTS invoice_lines_insert_finance ON public.invoice_lines;
    DROP POLICY IF EXISTS invoice_lines_update_finance ON public.invoice_lines;
    DROP POLICY IF EXISTS invoice_lines_delete_finance ON public.invoice_lines;

    CREATE POLICY invoice_lines_select_finance ON public.invoice_lines
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_lines.invoice_id
            AND public.finance_company_access(i.company_id)
        )
      );
    CREATE POLICY invoice_lines_insert_finance ON public.invoice_lines
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_lines.invoice_id
            AND public.finance_company_access(i.company_id)
        )
      );
    CREATE POLICY invoice_lines_update_finance ON public.invoice_lines
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_lines.invoice_id
            AND public.finance_company_access(i.company_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_lines.invoice_id
            AND public.finance_company_access(i.company_id)
        )
      );
    CREATE POLICY invoice_lines_delete_finance ON public.invoice_lines
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_lines.invoice_id
            AND public.finance_company_access(i.company_id)
        )
      );
  END IF;

  IF to_regclass('public.journal_lines') IS NOT NULL THEN
    DROP POLICY IF EXISTS jl_select_finance ON public.journal_lines;
    DROP POLICY IF EXISTS jl_insert_finance ON public.journal_lines;
    DROP POLICY IF EXISTS jl_update_finance ON public.journal_lines;
    DROP POLICY IF EXISTS jl_delete_finance ON public.journal_lines;

    CREATE POLICY jl_select_finance ON public.journal_lines
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_lines.journal_entry_id
            AND public.finance_company_access(je.company_id)
        )
      );
    CREATE POLICY jl_insert_finance ON public.journal_lines
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_lines.journal_entry_id
            AND public.finance_company_access(je.company_id)
        )
      );
    CREATE POLICY jl_update_finance ON public.journal_lines
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_lines.journal_entry_id
            AND public.finance_company_access(je.company_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_lines.journal_entry_id
            AND public.finance_company_access(je.company_id)
        )
      );
    CREATE POLICY jl_delete_finance ON public.journal_lines
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_lines.journal_entry_id
            AND public.finance_company_access(je.company_id)
        )
      );
  END IF;

  IF to_regclass('public.payment_invoice_allocations') IS NOT NULL THEN
    DROP POLICY IF EXISTS pia_select_finance ON public.payment_invoice_allocations;
    DROP POLICY IF EXISTS pia_insert_finance ON public.payment_invoice_allocations;
    DROP POLICY IF EXISTS pia_update_finance ON public.payment_invoice_allocations;
    DROP POLICY IF EXISTS pia_delete_finance ON public.payment_invoice_allocations;

    CREATE POLICY pia_select_finance ON public.payment_invoice_allocations
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.id = payment_invoice_allocations.payment_id
            AND public.finance_company_access(p.company_id)
        )
      );
    CREATE POLICY pia_insert_finance ON public.payment_invoice_allocations
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.id = payment_invoice_allocations.payment_id
            AND public.finance_company_access(p.company_id)
        )
      );
    CREATE POLICY pia_update_finance ON public.payment_invoice_allocations
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.id = payment_invoice_allocations.payment_id
            AND public.finance_company_access(p.company_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.id = payment_invoice_allocations.payment_id
            AND public.finance_company_access(p.company_id)
        )
      );
    CREATE POLICY pia_delete_finance ON public.payment_invoice_allocations
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.id = payment_invoice_allocations.payment_id
            AND public.finance_company_access(p.company_id)
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- H1: parties_suivi — strict company membership + commercial/ventes section
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS parties_suivi_select_company ON public.parties_suivi;
DROP POLICY IF EXISTS parties_suivi_insert_company ON public.parties_suivi;
DROP POLICY IF EXISTS parties_suivi_update_company ON public.parties_suivi;
DROP POLICY IF EXISTS parties_suivi_delete_company ON public.parties_suivi;

CREATE POLICY parties_suivi_select_company ON public.parties_suivi
  FOR SELECT TO authenticated
  USING (
    public.user_in_company(company_id)
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
  );

CREATE POLICY parties_suivi_insert_company ON public.parties_suivi
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_in_company(company_id)
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
  );

CREATE POLICY parties_suivi_update_company ON public.parties_suivi
  FOR UPDATE TO authenticated
  USING (
    public.user_in_company(company_id)
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
  )
  WITH CHECK (
    public.user_in_company(company_id)
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
  );

CREATE POLICY parties_suivi_delete_company ON public.parties_suivi
  FOR DELETE TO authenticated
  USING (
    public.user_in_company(company_id)
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
  );

-- ---------------------------------------------------------------------------
-- H2: user_companies INSERT — admin only (prevent moderator self-escalation)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_companies_insert_admin ON public.user_companies;
CREATE POLICY user_companies_insert_admin ON public.user_companies
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- H3: update_vehicle_kilometrage_actuel — company + vehicules section
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_vehicle_kilometrage_actuel(
  p_vehicle_id uuid,
  p_km numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_km IS NULL OR p_km < 0 THEN
    RAISE EXCEPTION 'invalid kilometrage';
  END IF;
  IF NOT public.user_has_any_app_section(ARRAY['vehicules']::text[]) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.vehicles v
  SET kilometrage_actuel = p_km,
      updated_at = timezone('utc'::text, now())
  WHERE v.id = p_vehicle_id
    AND v.company_id IN (SELECT public.user_company_ids());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle not found or unauthorized';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- H4: team_chat — limit read to colleagues (not global)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS team_chat_messages_select ON public.team_chat_messages;
CREATE POLICY team_chat_messages_select ON public.team_chat_messages
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_companies uc_self
      JOIN public.user_companies uc_other ON uc_other.company_id = uc_self.company_id
      WHERE uc_self.user_id = auth.uid()
        AND uc_other.user_id = team_chat_messages.user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_section_permissions usp_self
      JOIN public.user_section_permissions usp_other
        ON usp_other.section_key = usp_self.section_key
      WHERE usp_self.user_id = auth.uid()
        AND usp_other.user_id = team_chat_messages.user_id
    )
  );

-- ---------------------------------------------------------------------------
-- H5: get_user_ids_with_section_access — staff / same-section only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_ids_with_section_access(p_section_key text)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR public.user_has_app_section(p_section_key)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN (
    SELECT coalesce(array_agg(DISTINCT uid), '{}'::uuid[])
    FROM (
      SELECT user_id AS uid
      FROM public.user_section_permissions
      WHERE section_key = p_section_key
      UNION
      SELECT user_id AS uid
      FROM public.user_roles
      WHERE role IN ('admin'::public.app_role, 'moderator'::public.app_role)
    ) s
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- H6: Storage — company-prefixed paths + section gate
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_documents_select_section" ON storage.objects;
DROP POLICY IF EXISTS "client_documents_insert_section" ON storage.objects;
DROP POLICY IF EXISTS "client_documents_update_section" ON storage.objects;
DROP POLICY IF EXISTS "client_documents_delete_staff" ON storage.objects;
DROP POLICY IF EXISTS "product_documents_select_section" ON storage.objects;
DROP POLICY IF EXISTS "product_documents_insert_section" ON storage.objects;
DROP POLICY IF EXISTS "product_documents_update_section" ON storage.objects;
DROP POLICY IF EXISTS "product_documents_delete_staff" ON storage.objects;
DROP POLICY IF EXISTS "fiches_techniques_select_section" ON storage.objects;
DROP POLICY IF EXISTS "fiches_techniques_insert_section" ON storage.objects;
DROP POLICY IF EXISTS "fiches_techniques_update_section" ON storage.objects;
DROP POLICY IF EXISTS "fiches_techniques_delete_staff" ON storage.objects;
DROP POLICY IF EXISTS "gallery_photos_select_section" ON storage.objects;
DROP POLICY IF EXISTS "gallery_photos_insert_section" ON storage.objects;
DROP POLICY IF EXISTS "gallery_photos_update_section" ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_select ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_update ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_delete ON storage.objects;
DROP POLICY IF EXISTS client_documents_select_sec ON storage.objects;
DROP POLICY IF EXISTS client_documents_insert_sec ON storage.objects;
DROP POLICY IF EXISTS client_documents_update_sec ON storage.objects;
DROP POLICY IF EXISTS client_documents_delete_sec ON storage.objects;
DROP POLICY IF EXISTS product_documents_select_sec ON storage.objects;
DROP POLICY IF EXISTS product_documents_insert_sec ON storage.objects;
DROP POLICY IF EXISTS product_documents_update_sec ON storage.objects;
DROP POLICY IF EXISTS product_documents_delete_sec ON storage.objects;
DROP POLICY IF EXISTS fiches_techniques_select_sec ON storage.objects;
DROP POLICY IF EXISTS fiches_techniques_insert_sec ON storage.objects;
DROP POLICY IF EXISTS fiches_techniques_update_sec ON storage.objects;
DROP POLICY IF EXISTS fiches_techniques_delete_sec ON storage.objects;
DROP POLICY IF EXISTS gallery_photos_select_sec ON storage.objects;
DROP POLICY IF EXISTS gallery_photos_insert_sec ON storage.objects;
DROP POLICY IF EXISTS gallery_photos_update_sec ON storage.objects;
DROP POLICY IF EXISTS gallery_photos_delete_sec ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_select_sec ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_insert_sec ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_update_sec ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_delete_sec ON storage.objects;

CREATE POLICY client_documents_select_sec ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND public.user_has_app_section('ventes')
    AND public.storage_path_readable(name)
  );
CREATE POLICY client_documents_insert_sec ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND public.user_has_app_section('ventes')
    AND public.storage_path_writable(name)
  );
CREATE POLICY client_documents_update_sec ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND public.user_has_app_section('ventes')
    AND public.storage_path_readable(name)
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND public.user_has_app_section('ventes')
    AND public.storage_path_writable(name)
  );
CREATE POLICY client_documents_delete_sec ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND public.user_has_app_section('ventes')
    AND public.storage_path_readable(name)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY product_documents_select_sec ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-documents'
    AND public.user_has_any_app_section(ARRAY['magasin', 'achats']::text[])
    AND public.storage_path_readable(name)
  );
CREATE POLICY product_documents_insert_sec ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-documents'
    AND public.user_has_any_app_section(ARRAY['magasin', 'achats']::text[])
    AND public.storage_path_writable(name)
  );
CREATE POLICY product_documents_update_sec ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-documents'
    AND public.user_has_any_app_section(ARRAY['magasin', 'achats']::text[])
    AND public.storage_path_readable(name)
  )
  WITH CHECK (
    bucket_id = 'product-documents'
    AND public.user_has_any_app_section(ARRAY['magasin', 'achats']::text[])
    AND public.storage_path_writable(name)
  );
CREATE POLICY product_documents_delete_sec ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-documents'
    AND public.user_has_any_app_section(ARRAY['magasin', 'achats']::text[])
    AND public.storage_path_readable(name)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY fiches_techniques_select_sec ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fiches-techniques'
    AND public.user_has_any_app_section(ARRAY['magasin', 'ventes', 'achats']::text[])
    AND public.storage_path_readable(name)
  );
CREATE POLICY fiches_techniques_insert_sec ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fiches-techniques'
    AND public.user_has_any_app_section(ARRAY['magasin', 'ventes', 'achats']::text[])
    AND public.storage_path_writable(name)
  );
CREATE POLICY fiches_techniques_update_sec ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fiches-techniques'
    AND public.user_has_any_app_section(ARRAY['magasin', 'ventes', 'achats']::text[])
    AND public.storage_path_readable(name)
  )
  WITH CHECK (
    bucket_id = 'fiches-techniques'
    AND public.user_has_any_app_section(ARRAY['magasin', 'ventes', 'achats']::text[])
    AND public.storage_path_writable(name)
  );
CREATE POLICY fiches_techniques_delete_sec ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fiches-techniques'
    AND public.storage_path_readable(name)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY gallery_photos_select_sec ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gallery-photos'
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
    AND public.storage_path_readable(name)
  );
CREATE POLICY gallery_photos_insert_sec ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery-photos'
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
    AND public.storage_path_writable(name)
  );
CREATE POLICY gallery_photos_update_sec ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gallery-photos'
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
    AND public.storage_path_readable(name)
  )
  WITH CHECK (
    bucket_id = 'gallery-photos'
    AND public.user_has_any_app_section(ARRAY['commercial', 'ventes']::text[])
    AND public.storage_path_writable(name)
  );
CREATE POLICY gallery_photos_delete_sec ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery-photos'
    AND public.storage_path_readable(name)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY commercial_attachments_select_sec ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'commercial-attachments'
    AND public.user_has_any_app_section(ARRAY['ventes', 'achats']::text[])
    AND public.storage_path_readable(name)
  );
CREATE POLICY commercial_attachments_insert_sec ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-attachments'
    AND public.user_has_any_app_section(ARRAY['ventes', 'achats']::text[])
    AND public.storage_path_writable(name)
  );
CREATE POLICY commercial_attachments_update_sec ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'commercial-attachments'
    AND public.user_has_any_app_section(ARRAY['ventes', 'achats']::text[])
    AND public.storage_path_readable(name)
  )
  WITH CHECK (
    bucket_id = 'commercial-attachments'
    AND public.user_has_any_app_section(ARRAY['ventes', 'achats']::text[])
    AND public.storage_path_writable(name)
  );
CREATE POLICY commercial_attachments_delete_sec ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'commercial-attachments'
    AND public.storage_path_readable(name)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
