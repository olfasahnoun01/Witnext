-- =============================================================================
-- Multi-company isolation for clients & fournisseurs
--
-- Context:
--   * Ventes / Achats / Inventaire are Grosafe-only modules.
--   * Finance is multi-company (grosafe, granisafe, safe_team).
--   => Existing clients/fournisseurs rows belong to Grosafe; new companies get
--      their own isolated tiers (created later via Finance).
--
-- Safety model (IMPORTANT):
--   Not every user has a `user_companies` row (only admins/moderators and
--   Finance-permissioned users do — see 20260525150000_audit_remaining_fixes).
--   Regular Ventes/Achats/Magasin users have NONE. To avoid locking them out,
--   Grosafe tier data stays readable/writable by ALL authenticated users
--   (preserving historical behavior), while granisafe/safe_team tier data is
--   restricted to members of those companies.
--
-- This migration is idempotent and safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helper: resolve Grosafe company id, bypassing `companies` RLS.
--    SECURITY DEFINER so non-members (who can't SELECT companies) can still
--    resolve the Grosafe id for the open-access fallback and for app filters.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 1. Add company_id columns + backfill existing rows to Grosafe.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  grosafe_id uuid;
BEGIN
  SELECT public.grosafe_company_id() INTO grosafe_id;
  IF grosafe_id IS NULL THEN
    RAISE EXCEPTION 'Grosafe company is missing. Apply 20260504120000_finance_multi_company.sql first.';
  END IF;

  ALTER TABLE public.clients      ADD COLUMN IF NOT EXISTS company_id uuid;
  ALTER TABLE public.fournisseurs ADD COLUMN IF NOT EXISTS company_id uuid;

  UPDATE public.clients      SET company_id = grosafe_id WHERE company_id IS NULL;
  UPDATE public.fournisseurs SET company_id = grosafe_id WHERE company_id IS NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Foreign keys, NOT NULL, indexes.
-- -----------------------------------------------------------------------------
ALTER TABLE public.clients      ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.fournisseurs ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.clients      DROP CONSTRAINT IF EXISTS clients_company_id_fkey;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE RESTRICT;

ALTER TABLE public.fournisseurs DROP CONSTRAINT IF EXISTS fournisseurs_company_id_fkey;
ALTER TABLE public.fournisseurs
  ADD CONSTRAINT fournisseurs_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS clients_company_id_idx      ON public.clients (company_id);
CREATE INDEX IF NOT EXISTS fournisseurs_company_id_idx ON public.fournisseurs (company_id);

-- -----------------------------------------------------------------------------
-- 3. Default trigger: any insert without company_id lands in Grosafe.
--    Safety net so legacy Ventes/Achats inserts keep working during rollout.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_company_id_default_grosafe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.grosafe_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_default_company ON public.clients;
CREATE TRIGGER clients_default_company
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default_grosafe();

DROP TRIGGER IF EXISTS fournisseurs_default_company ON public.fournisseurs;
CREATE TRIGGER fournisseurs_default_company
  BEFORE INSERT ON public.fournisseurs
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default_grosafe();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security.
--    Access rule (SELECT/INSERT/UPDATE/DELETE):
--      * Grosafe rows  -> any authenticated user (historical open behavior).
--      * Other company -> only members listed in user_companies.
-- -----------------------------------------------------------------------------
ALTER TABLE public.clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;

-- Remove legacy / permissive policies so the new model is authoritative.
DROP POLICY IF EXISTS "Authenticated users can read fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "All authenticated users can read fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "All authenticated users can insert fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "All authenticated users can update fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "All authenticated users can delete fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;
DROP POLICY IF EXISTS "All authenticated users can read clients" ON public.clients;
DROP POLICY IF EXISTS "All authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "All authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "All authenticated users can delete clients" ON public.clients;

-- clients --------------------------------------------------------------------
DROP POLICY IF EXISTS clients_select_company ON public.clients;
CREATE POLICY clients_select_company ON public.clients
  FOR SELECT TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS clients_insert_company ON public.clients;
CREATE POLICY clients_insert_company ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS clients_update_company ON public.clients;
CREATE POLICY clients_update_company ON public.clients
  FOR UPDATE TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  )
  WITH CHECK (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS clients_delete_company ON public.clients;
CREATE POLICY clients_delete_company ON public.clients
  FOR DELETE TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

-- fournisseurs ---------------------------------------------------------------
DROP POLICY IF EXISTS fournisseurs_select_company ON public.fournisseurs;
CREATE POLICY fournisseurs_select_company ON public.fournisseurs
  FOR SELECT TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS fournisseurs_insert_company ON public.fournisseurs;
CREATE POLICY fournisseurs_insert_company ON public.fournisseurs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS fournisseurs_update_company ON public.fournisseurs;
CREATE POLICY fournisseurs_update_company ON public.fournisseurs
  FOR UPDATE TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  )
  WITH CHECK (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS fournisseurs_delete_company ON public.fournisseurs;
CREATE POLICY fournisseurs_delete_company ON public.fournisseurs
  FOR DELETE TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

COMMENT ON COLUMN public.clients.company_id IS
  'Société propriétaire du client (Finance multi-sociétés). Grosafe par défaut.';
COMMENT ON COLUMN public.fournisseurs.company_id IS
  'Société propriétaire du fournisseur (Finance multi-sociétés). Grosafe par défaut.';
