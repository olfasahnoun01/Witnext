-- Crédit-bail véhicules — échéancier mensuel par contrat et société
CREATE TABLE IF NOT EXISTS public.leasing_credit_contracts (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  contract_number text NOT NULL,
  contract_date date NOT NULL,
  year integer NOT NULL,
  monthly_schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leasing_credit_contracts_year_chk CHECK (year >= 2000 AND year <= 2100),
  CONSTRAINT leasing_credit_contracts_uk UNIQUE (company_id, contract_number, year)
);

CREATE INDEX IF NOT EXISTS leasing_credit_contracts_company_year_idx
  ON public.leasing_credit_contracts (company_id, year);

DROP TRIGGER IF EXISTS handle_leasing_credit_contracts_updated_at ON public.leasing_credit_contracts;
CREATE TRIGGER handle_leasing_credit_contracts_updated_at
  BEFORE UPDATE ON public.leasing_credit_contracts
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at ();

ALTER TABLE public.leasing_credit_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leasing_credit_contracts_select ON public.leasing_credit_contracts;
CREATE POLICY leasing_credit_contracts_select ON public.leasing_credit_contracts
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS leasing_credit_contracts_insert ON public.leasing_credit_contracts;
CREATE POLICY leasing_credit_contracts_insert ON public.leasing_credit_contracts
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS leasing_credit_contracts_update ON public.leasing_credit_contracts;
CREATE POLICY leasing_credit_contracts_update ON public.leasing_credit_contracts
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()))
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));

DROP POLICY IF EXISTS leasing_credit_contracts_delete ON public.leasing_credit_contracts;
CREATE POLICY leasing_credit_contracts_delete ON public.leasing_credit_contracts
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()));
