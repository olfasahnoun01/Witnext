-- Paie tunisienne : fiches mensuelles + base déclaration CNSS trimestrielle

ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matricule_cnss text,
  ADD COLUMN IF NOT EXISTS taux_horaire numeric(12, 3) NOT NULL DEFAULT 0;

UPDATE public.hr_employees
SET matricule_cnss = 'NC-' || substr(id::text, 1, 8)
WHERE matricule_cnss IS NULL OR trim(matricule_cnss) = '';

ALTER TABLE public.hr_employees
  ALTER COLUMN matricule_cnss SET NOT NULL;

ALTER TABLE public.hr_payroll_movements
  DROP CONSTRAINT IF EXISTS hr_payroll_movements_movement_type_check;

ALTER TABLE public.hr_payroll_movements
  ADD CONSTRAINT hr_payroll_movements_movement_type_check
  CHECK (movement_type IN ('avance', 'penalite', 'pret'));

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (company_id, year, month)
);

DROP TRIGGER IF EXISTS update_payroll_periods_updated_at ON public.payroll_periods;
CREATE TRIGGER update_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.payroll_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  matricule_cnss text NOT NULL,
  taux_horaire numeric(12, 3) NOT NULL DEFAULT 0,
  jours_ht numeric(8, 2) NOT NULL DEFAULT 0,
  nb_heures numeric(10, 2) NOT NULL DEFAULT 0,
  nb_heures_supp numeric(10, 2) NOT NULL DEFAULT 0,
  jours_conge numeric(8, 2) NOT NULL DEFAULT 0,
  jours_ferie numeric(8, 2) NOT NULL DEFAULT 0,
  salaire_base numeric(12, 3) NOT NULL DEFAULT 0,
  primes numeric(12, 3) NOT NULL DEFAULT 0,
  salaire_brut numeric(12, 3) NOT NULL DEFAULT 0,
  cnss_salariale numeric(12, 3) NOT NULL DEFAULT 0,
  salaire_declare_cnss numeric(12, 3) NOT NULL DEFAULT 0,
  salaire_imposable numeric(12, 3) NOT NULL DEFAULT 0,
  irpp numeric(12, 3) NOT NULL DEFAULT 0,
  css numeric(12, 3) NOT NULL DEFAULT 0,
  salaire_net numeric(12, 3) NOT NULL DEFAULT 0,
  avances numeric(12, 3) NOT NULL DEFAULT 0,
  prets numeric(12, 3) NOT NULL DEFAULT 0,
  penalites numeric(12, 3) NOT NULL DEFAULT 0,
  net_a_payer numeric(12, 3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (period_id, employee_id)
);

DROP TRIGGER IF EXISTS update_payroll_slips_updated_at ON public.payroll_slips;
CREATE TRIGGER update_payroll_slips_updated_at
  BEFORE UPDATE ON public.payroll_slips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS payroll_slips_period_idx ON public.payroll_slips (period_id);
CREATE INDEX IF NOT EXISTS payroll_periods_company_ym_idx ON public.payroll_periods (company_id, year, month);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_periods_select ON public.payroll_periods;
DROP POLICY IF EXISTS payroll_periods_mutate ON public.payroll_periods;
DROP POLICY IF EXISTS payroll_slips_select ON public.payroll_slips;
DROP POLICY IF EXISTS payroll_slips_mutate ON public.payroll_slips;

CREATE POLICY payroll_periods_select ON public.payroll_periods FOR SELECT TO authenticated
  USING (
    public.user_has_app_section('finance')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY payroll_periods_mutate ON public.payroll_periods FOR ALL TO authenticated
  USING (
    public.user_has_app_section('finance')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  WITH CHECK (
    public.user_has_app_section('finance')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY payroll_slips_select ON public.payroll_slips FOR SELECT TO authenticated
  USING (
    public.user_has_app_section('finance')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY payroll_slips_mutate ON public.payroll_slips FOR ALL TO authenticated
  USING (
    public.user_has_app_section('finance')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  WITH CHECK (
    public.user_has_app_section('finance')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );
