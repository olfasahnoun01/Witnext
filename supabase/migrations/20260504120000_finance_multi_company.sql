-- =============================================================================
-- Module FINANCE multi-sociétés (schéma + RLS)
-- Sociétés: Grosafe Equipements, Granisafe Solution, Safe-Team
-- Ne modifie pas les tables métier existantes (devis, factures commerce, etc.)
-- =============================================================================

-- 1) Référentiel sociétés
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_code_chk CHECK (code IN ('grosafe', 'granisafe', 'safe_team'))
);

COMMENT ON TABLE public.companies IS 'Entités légales / sociétés pour le module Finance.';

INSERT INTO public.companies (code, name) VALUES
  ('grosafe', 'Grosafe Equipements'),
  ('granisafe', 'Granisafe Solution'),
  ('safe_team', 'Safe-Team')
ON CONFLICT (code) DO NOTHING;

-- 2) Liaison utilisateur ↔ sociétés (accès données Finance)
CREATE TABLE IF NOT EXISTS public.user_companies (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);

COMMENT ON TABLE public.user_companies IS 'Societes Finance visibles par utilisateur (RLS).';

-- 3) Factures module Finance (distinct des factures Ventes `public.factures`)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  invoice_type text NOT NULL DEFAULT 'vente',
  numero text NOT NULL,
  counterpart_name text,
  counterpart_tax_id text,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  currency text NOT NULL DEFAULT 'TND',
  total_ht numeric(14, 3) NOT NULL DEFAULT 0,
  total_ttc numeric(14, 3) NOT NULL DEFAULT 0,
  vat_amount numeric(14, 3) NOT NULL DEFAULT 0,
  amount_paid numeric(14, 3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_type_chk CHECK (invoice_type IN ('vente', 'achat')),
  CONSTRAINT invoices_status_chk CHECK (status IN ('draft', 'issued', 'partial', 'paid', 'void')),
  CONSTRAINT invoices_numero_company_uk UNIQUE (company_id, numero)
);

CREATE INDEX IF NOT EXISTS invoices_company_issue_idx ON public.invoices (company_id, issue_date DESC);

CREATE OR REPLACE FUNCTION public.finance_set_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_invoices_updated_at ON public.invoices;
CREATE TRIGGER handle_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at ();

-- 4) Paiements
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14, 3) NOT NULL,
  method text NOT NULL DEFAULT 'transfer',
  direction text NOT NULL,
  counterparty_name text,
  reference text,
  notes text,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_direction_chk CHECK (direction IN ('inbound_client', 'outbound_supplier', 'internal')),
  CONSTRAINT payments_method_chk CHECK (method IN ('cash', 'transfer', 'check', 'card', 'other'))
);

CREATE INDEX IF NOT EXISTS payments_company_date_idx ON public.payments (company_id, payment_date DESC);

DROP TRIGGER IF EXISTS handle_payments_updated_at ON public.payments;
CREATE TRIGGER handle_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at ();

-- 5) Lettrage paiements ↔ factures (multi-factures, paiements partiels)
CREATE TABLE IF NOT EXISTS public.payment_invoice_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE RESTRICT,
  amount numeric(14, 3) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS pia_invoice_idx ON public.payment_invoice_allocations (invoice_id);

CREATE OR REPLACE FUNCTION public.enforce_allocation_same_company ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  p_company uuid;
  i_company uuid;
BEGIN
  SELECT company_id INTO p_company FROM public.payments WHERE id = NEW.payment_id;
  SELECT company_id INTO i_company FROM public.invoices WHERE id = NEW.invoice_id;
  IF p_company IS DISTINCT FROM i_company THEN
    RAISE EXCEPTION 'payment_invoice_allocations: company mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pia_same_company ON public.payment_invoice_allocations;
CREATE TRIGGER trg_pia_same_company
  BEFORE INSERT OR UPDATE ON public.payment_invoice_allocations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_allocation_same_company ();

-- 6) Écritures comptables (journal)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  memo text,
  source text NOT NULL DEFAULT 'manual',
  posted boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_entries_company_date_idx ON public.journal_entries (company_id, entry_date DESC);

DROP TRIGGER IF EXISTS handle_journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER handle_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at ();

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries (id) ON DELETE CASCADE,
  account_code text NOT NULL,
  line_memo text,
  debit numeric(14, 3) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14, 3) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  vat_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON public.journal_lines (journal_entry_id);

-- 7) TVA / déclarations fiscales (résumés période)
CREATE TABLE IF NOT EXISTS public.tax_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  vat_collected numeric(14, 3) NOT NULL DEFAULT 0,
  vat_deductible_purchases numeric(14, 3) NOT NULL DEFAULT 0,
  net_vat_due numeric(14, 3) NOT NULL DEFAULT 0,
  withholding_supplier numeric(14, 3),
  withholding_at_source_other numeric(14, 3),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  filed_at timestamptz,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_declarations_status_chk CHECK (status IN ('draft', 'filed', 'adjusted')),
  CONSTRAINT tax_declarations_period_uk UNIQUE (company_id, period_start, period_end)
);

DROP TRIGGER IF EXISTS handle_tax_declarations_updated_at ON public.tax_declarations;
CREATE TRIGGER handle_tax_declarations_updated_at
  BEFORE UPDATE ON public.tax_declarations
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at ();

-- 8) Trésorerie (mouvements agrégés / prévisionnel)
CREATE TABLE IF NOT EXISTS public.treasury_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount_signed numeric(14, 3) NOT NULL,
  linked_payment_id uuid REFERENCES public.payments (id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treasury_company_date_idx ON public.treasury_movements (company_id, movement_date DESC);

-- =============================================================================
-- RLS : accès uniquement aux sociétés listées dans user_companies
-- =============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_invoice_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_movements ENABLE ROW LEVEL SECURITY;

-- companies : lecture des sociétés autorisées
DROP POLICY IF EXISTS companies_select_finance ON public.companies;
CREATE POLICY companies_select_finance ON public.companies
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

-- user_companies
DROP POLICY IF EXISTS user_companies_select_own ON public.user_companies;
CREATE POLICY user_companies_select_own ON public.user_companies
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid ()
    OR public.has_role (auth.uid (), 'admin'::app_role)
    OR public.has_role (auth.uid (), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS user_companies_insert_admin ON public.user_companies;
CREATE POLICY user_companies_insert_admin ON public.user_companies
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role (auth.uid (), 'admin'::app_role)
    OR public.has_role (auth.uid (), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS user_companies_delete_admin ON public.user_companies;
CREATE POLICY user_companies_delete_admin ON public.user_companies
  FOR DELETE TO authenticated
  USING (
    public.has_role (auth.uid (), 'admin'::app_role)
    OR public.has_role (auth.uid (), 'moderator'::app_role)
  );

-- Factures / paiements / journal / TVA / trésorerie : même filtre company_id
DROP POLICY IF EXISTS invoices_select_finance ON public.invoices;
CREATE POLICY invoices_select_finance ON public.invoices
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS invoices_insert_finance ON public.invoices;
CREATE POLICY invoices_insert_finance ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS invoices_update_finance ON public.invoices;
CREATE POLICY invoices_update_finance ON public.invoices
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()))
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS invoices_delete_finance ON public.invoices;
CREATE POLICY invoices_delete_finance ON public.invoices
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS payments_select_finance ON public.payments;
CREATE POLICY payments_select_finance ON public.payments
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS payments_insert_finance ON public.payments;
CREATE POLICY payments_insert_finance ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS payments_update_finance ON public.payments;
CREATE POLICY payments_update_finance ON public.payments
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()))
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS payments_delete_finance ON public.payments;
CREATE POLICY payments_delete_finance ON public.payments
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

-- Allocations : via paiement / facture déjà filtrés (double contrôle)
DROP POLICY IF EXISTS pia_select_finance ON public.payment_invoice_allocations;
CREATE POLICY pia_select_finance ON public.payment_invoice_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND p.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  );

DROP POLICY IF EXISTS pia_insert_finance ON public.payment_invoice_allocations;
CREATE POLICY pia_insert_finance ON public.payment_invoice_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND p.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  );

DROP POLICY IF EXISTS pia_update_finance ON public.payment_invoice_allocations;
CREATE POLICY pia_update_finance ON public.payment_invoice_allocations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND p.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND p.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  );

DROP POLICY IF EXISTS pia_delete_finance ON public.payment_invoice_allocations;
CREATE POLICY pia_delete_finance ON public.payment_invoice_allocations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND p.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  );

DROP POLICY IF EXISTS je_select_finance ON public.journal_entries;
CREATE POLICY je_select_finance ON public.journal_entries
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS je_insert_finance ON public.journal_entries;
CREATE POLICY je_insert_finance ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS je_update_finance ON public.journal_entries;
CREATE POLICY je_update_finance ON public.journal_entries
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()))
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS je_delete_finance ON public.journal_entries;
CREATE POLICY je_delete_finance ON public.journal_entries
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS jl_select_finance ON public.journal_lines;
CREATE POLICY jl_select_finance ON public.journal_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  );

DROP POLICY IF EXISTS jl_insert_finance ON public.journal_lines;
CREATE POLICY jl_insert_finance ON public.journal_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  );

DROP POLICY IF EXISTS jl_update_finance ON public.journal_lines;
CREATE POLICY jl_update_finance ON public.journal_lines
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  );

DROP POLICY IF EXISTS jl_delete_finance ON public.journal_lines;
CREATE POLICY jl_delete_finance ON public.journal_lines
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
    )
  );

DROP POLICY IF EXISTS tax_select_finance ON public.tax_declarations;
CREATE POLICY tax_select_finance ON public.tax_declarations
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS tax_insert_finance ON public.tax_declarations;
CREATE POLICY tax_insert_finance ON public.tax_declarations
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS tax_update_finance ON public.tax_declarations;
CREATE POLICY tax_update_finance ON public.tax_declarations
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()))
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS tax_delete_finance ON public.tax_declarations;
CREATE POLICY tax_delete_finance ON public.tax_declarations
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS treasury_select_finance ON public.treasury_movements;
CREATE POLICY treasury_select_finance ON public.treasury_movements
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS treasury_insert_finance ON public.treasury_movements;
CREATE POLICY treasury_insert_finance ON public.treasury_movements
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS treasury_update_finance ON public.treasury_movements;
CREATE POLICY treasury_update_finance ON public.treasury_movements
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()))
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS treasury_delete_finance ON public.treasury_movements;
CREATE POLICY treasury_delete_finance ON public.treasury_movements
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

-- =============================================================================
-- Bootstrap accès (idempotent)
-- =============================================================================

-- Tous les profils → société Grosafe (comportement historique par défaut)
INSERT INTO public.user_companies (user_id, company_id)
SELECT p.user_id, c.id
FROM public.profiles p
JOIN public.companies c ON c.code = 'grosafe'
ON CONFLICT DO NOTHING;

-- Admins / modérateurs → les 3 sociétés (pilotage multi-sociétés)
INSERT INTO public.user_companies (user_id, company_id)
SELECT ur.user_id, c.id
FROM public.user_roles ur
CROSS JOIN public.companies c
WHERE ur.role IN ('admin'::app_role, 'moderator'::app_role)
ON CONFLICT DO NOTHING;

-- Entree menu Finance (permissions navigation) pour tous les profils existants
INSERT INTO public.user_section_permissions (user_id, section_key, subsection_key)
SELECT p.user_id, 'finance', 'finance-hub'
FROM public.profiles p
ON CONFLICT (user_id, section_key, subsection_key) DO NOTHING;
