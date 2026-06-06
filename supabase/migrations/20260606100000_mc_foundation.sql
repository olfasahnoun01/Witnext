-- =============================================================================
-- MULTI-COMPANY FOUNDATION (Phase 1)
--
-- Promotes the Finance multi-company model to the whole ERP.
--   * Helper functions reused by every company-scoped RLS policy.
--   * A generic installer (mc_setup_company_column) so every operational table
--     gets company_id + backfill + FK + index + default trigger consistently.
--   * Strict backfill: EVERY existing user gets at least one user_companies row
--     (default Grosafe) so enabling strict RLS later cannot lock anyone out.
--
-- Idempotent and safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Core helpers
-- -----------------------------------------------------------------------------

-- Resolve Grosafe id bypassing companies RLS (already exists; re-assert for fresh DBs).
CREATE OR REPLACE FUNCTION public.grosafe_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.companies WHERE code = 'grosafe' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.grosafe_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grosafe_company_id() TO authenticated;

-- The set of company ids the caller belongs to. SECURITY DEFINER so it can read
-- user_companies regardless of that table's RLS. Used by every scoped policy.
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uc.company_id
  FROM public.user_companies uc
  WHERE uc.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.user_company_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_company_ids() TO authenticated;

-- Boolean convenience helper.
CREATE OR REPLACE FUNCTION public.user_in_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.company_id = p_company_id
  );
$$;

REVOKE ALL ON FUNCTION public.user_in_company(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_in_company(uuid) TO authenticated;

-- App-wide list of the caller's companies (generalizes finance_list_my_companies).
CREATE OR REPLACE FUNCTION public.list_my_companies()
RETURNS SETOF public.companies
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.companies c
  INNER JOIN public.user_companies uc ON uc.company_id = c.id
  WHERE uc.user_id = auth.uid()
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.list_my_companies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_companies() TO authenticated;

COMMENT ON FUNCTION public.list_my_companies() IS 'Companies linked to auth.uid() via user_companies (app-wide company switcher).';

-- -----------------------------------------------------------------------------
-- 1. Default-company trigger function (re-assert; shared by every table).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_company_id_default_grosafe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_single uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    -- If the caller belongs to exactly one company, default to it (correct for
    -- single-company Granisafe/Safe-Team users). Otherwise fall back to Grosafe.
    SELECT CASE WHEN count(*) = 1 THEN min(company_id) ELSE NULL END
    INTO v_single
    FROM public.user_companies
    WHERE user_id = auth.uid();

    NEW.company_id := COALESCE(v_single, public.grosafe_company_id());
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Generic installer: add company_id to a table the standard way.
--    - adds nullable column
--    - backfills NULLs to Grosafe
--    - sets NOT NULL
--    - adds FK -> companies(id) ON DELETE RESTRICT
--    - adds an index
--    - attaches the default-company BEFORE INSERT trigger
--    No-op if the table does not exist (schema drift safe).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mc_setup_company_column(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_grosafe uuid;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RAISE NOTICE 'mc_setup_company_column: table % absent, skipping', p_table;
    RETURN;
  END IF;

  SELECT public.grosafe_company_id() INTO v_grosafe;
  IF v_grosafe IS NULL THEN
    RAISE EXCEPTION 'Grosafe company missing; run 20260504120000_finance_multi_company.sql first';
  END IF;

  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid', p_table);
  EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', p_table, v_grosafe);
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', p_table);

  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', p_table, p_table || '_company_id_fkey');
  EXECUTE format(
    'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT',
    p_table, p_table || '_company_id_fkey'
  );

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)', p_table || '_company_id_idx', p_table);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', p_table || '_default_company', p_table);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default_grosafe()',
    p_table || '_default_company', p_table
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Generic installer for standard company-scoped CRUD RLS policies.
--    Drops ALL existing policies on the table (only the ones we target) and
--    installs strict company-membership policies.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mc_apply_company_rls(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RAISE NOTICE 'mc_apply_company_rls: table % absent, skipping', p_table;
    RETURN;
  END IF;

  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, p_table);
  END LOOP;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);

  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (company_id IN (SELECT public.user_company_ids()))',
    p_table || '_mc_select', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT public.user_company_ids()))',
    p_table || '_mc_insert', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (company_id IN (SELECT public.user_company_ids())) WITH CHECK (company_id IN (SELECT public.user_company_ids()))',
    p_table || '_mc_update', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (company_id IN (SELECT public.user_company_ids()))',
    p_table || '_mc_delete', p_table);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. STRICT BACKFILL (critical): every existing user must belong to >= 1 company.
--    The audit migration (20260525150000) removed user_companies rows for
--    non-finance/non-admin users; strict RLS would lock them out. Re-grant the
--    historical default (Grosafe) to all profiles. Admins/mods get all 3.
-- -----------------------------------------------------------------------------
INSERT INTO public.user_companies (user_id, company_id)
SELECT p.user_id, public.grosafe_company_id()
FROM public.profiles p
WHERE public.grosafe_company_id() IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_companies (user_id, company_id)
SELECT ur.user_id, c.id
FROM public.user_roles ur
CROSS JOIN public.companies c
WHERE ur.role IN ('admin'::public.app_role, 'moderator'::public.app_role)
ON CONFLICT DO NOTHING;
