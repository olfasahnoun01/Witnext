-- =============================================================================
-- Finance treasury / avoirs / withholding / bank fees → database tables
--
-- Moves data that previously lived in browser localStorage into company-scoped
-- Postgres tables protected by RLS (member-only via user_companies), so the
-- data is shared across devices/users and properly isolated per company.
--
-- Design notes:
--   * Primary keys are TEXT and client-generated (e.g. "acc-...", "av-...").
--     This preserves existing references — notably treasury_movements.notes
--     carries a "finance_account_id:<id>" tag pointing at these account ids.
--   * Treasury is a Finance-only domain (never used by Ventes/Achats), so the
--     standard user_companies RLS is correct here (no Grosafe-open fallback).
--   * Idempotent: safe to re-run.
-- =============================================================================

-- Reusable updated_at trigger already exists: public.finance_set_updated_at()

-- -----------------------------------------------------------------------------
-- 1. Treasury accounts (banque / caisse / attente effets)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treasury_accounts (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  nom text NOT NULL,
  type text NOT NULL,
  code_comptable text NOT NULL DEFAULT '',
  rib text,
  banque_label text,
  solde_actuel numeric(14, 3) NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treasury_accounts_type_chk CHECK (type IN ('BANQUE', 'CAISSE', 'ATTENTE_EFFETS'))
);
CREATE INDEX IF NOT EXISTS treasury_accounts_company_idx ON public.treasury_accounts (company_id);

DROP TRIGGER IF EXISTS handle_treasury_accounts_updated_at ON public.treasury_accounts;
CREATE TRIGGER handle_treasury_accounts_updated_at
  BEFORE UPDATE ON public.treasury_accounts
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at ();

-- -----------------------------------------------------------------------------
-- 2. Inter-account transfers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treasury_transfers (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  compte_source_id text NOT NULL,
  compte_destination_id text NOT NULL,
  montant numeric(14, 3) NOT NULL,
  date_operation date NOT NULL DEFAULT CURRENT_DATE,
  motif text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS treasury_transfers_company_idx ON public.treasury_transfers (company_id);

-- -----------------------------------------------------------------------------
-- 3. Financial avoirs (note de crédit financière)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_avoirs (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  type text NOT NULL,
  numero text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  counterparty_id bigint NOT NULL,
  counterparty_name text NOT NULL,
  counterparty_tax_id text,
  lignes jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_ht numeric(14, 3) NOT NULL DEFAULT 0,
  total_tva numeric(14, 3) NOT NULL DEFAULT 0,
  total_ttc numeric(14, 3) NOT NULL DEFAULT 0,
  credit_restant numeric(14, 3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'brouillon',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_avoirs_type_chk CHECK (type IN ('vente', 'achat')),
  CONSTRAINT finance_avoirs_status_chk CHECK (status IN ('brouillon', 'valide', 'annule'))
);
CREATE INDEX IF NOT EXISTS finance_avoirs_company_idx ON public.finance_avoirs (company_id);

-- -----------------------------------------------------------------------------
-- 4. Avoirs par article (liés à une facture)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_avoirs_article (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  type text NOT NULL,
  numero text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_id uuid,
  invoice_numero text,
  counterparty_id bigint NOT NULL,
  counterparty_name text NOT NULL,
  counterparty_tax_id text,
  lignes jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_ht numeric(14, 3) NOT NULL DEFAULT 0,
  total_tva numeric(14, 3) NOT NULL DEFAULT 0,
  total_ttc numeric(14, 3) NOT NULL DEFAULT 0,
  credit_restant numeric(14, 3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'brouillon',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_avoirs_article_type_chk CHECK (type IN ('vente', 'achat')),
  CONSTRAINT finance_avoirs_article_status_chk CHECK (status IN ('brouillon', 'valide', 'annule'))
);
CREATE INDEX IF NOT EXISTS finance_avoirs_article_company_idx ON public.finance_avoirs_article (company_id);

-- -----------------------------------------------------------------------------
-- 5. Withholding certificates (retenue à la source)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withholding_certificates (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  mode text NOT NULL,
  counterparty_id bigint NOT NULL,
  counterparty_name text NOT NULL,
  matricule_fiscal text,
  payment_id uuid,
  lignes jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_retenue numeric(14, 3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT withholding_mode_chk CHECK (mode IN ('PAYEUR', 'BENEFICIAIRE'))
);
CREATE INDEX IF NOT EXISTS withholding_certificates_company_idx ON public.withholding_certificates (company_id);

-- -----------------------------------------------------------------------------
-- 6. Bank fee type definitions (custom labels per company)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_fee_types (
  id text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, id)
);

-- -----------------------------------------------------------------------------
-- 7. Bank fees / charges
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_fees (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  treasury_account_id text NOT NULL,
  treasury_account_name text NOT NULL DEFAULT '',
  fee_type_id text NOT NULL,
  fee_type_label text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  montant_ht numeric(14, 3) NOT NULL DEFAULT 0,
  taux_tva numeric(5, 2) NOT NULL DEFAULT 0,
  montant_tva numeric(14, 3) NOT NULL DEFAULT 0,
  montant_ttc numeric(14, 3) NOT NULL DEFAULT 0,
  date_operation date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  status text NOT NULL DEFAULT 'PAYEE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_fees_status_chk CHECK (status IN ('PAYEE', 'IMPAYEE', 'EN_COURS'))
);
CREATE INDEX IF NOT EXISTS bank_fees_company_idx ON public.bank_fees (company_id);

-- -----------------------------------------------------------------------------
-- 8. Imported bank statement lines (reconciliation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  account_id text NOT NULL,
  operation_date date NOT NULL,
  value_date date,
  label text NOT NULL DEFAULT '',
  amount_signed numeric(14, 3) NOT NULL DEFAULT 0,
  reference text,
  matched_movement_id text,
  matched_payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_statement_lines_company_idx ON public.bank_statement_lines (company_id);

-- =============================================================================
-- Row Level Security — member-only via user_companies (same pattern as invoices)
-- =============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'treasury_accounts',
    'treasury_transfers',
    'finance_avoirs',
    'finance_avoirs_article',
    'withholding_certificates',
    'bank_fee_types',
    'bank_fees',
    'bank_statement_lines'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_select', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated
        USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));
    $f$, t || '_select', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_insert', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));
    $f$, t || '_insert', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_update', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR UPDATE TO authenticated
        USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()))
        WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));
    $f$, t || '_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_delete', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR DELETE TO authenticated
        USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));
    $f$, t || '_delete', t);
  END LOOP;
END $$;
