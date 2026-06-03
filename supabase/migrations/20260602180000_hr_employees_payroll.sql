-- RH : registre employés (sans auth), congés, avances / pénalités

CREATE TABLE IF NOT EXISTS public.hr_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom text NOT NULL,
  nom text NOT NULL,
  cin text,
  phone1 text,
  phone2 text,
  adresse text,
  contract_url text,
  salaire_net numeric(12, 3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS update_hr_employees_updated_at ON public.hr_employees;
CREATE TRIGGER update_hr_employees_updated_at
  BEFORE UPDATE ON public.hr_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.hr_employee_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  date_from date NOT NULL,
  date_to date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT hr_employee_leaves_dates_check CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS hr_employee_leaves_employee_idx
  ON public.hr_employee_leaves (employee_id, date_from DESC);

CREATE TABLE IF NOT EXISTS public.hr_payroll_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('avance', 'penalite')),
  amount numeric(12, 3) NOT NULL CHECK (amount > 0),
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS hr_payroll_movements_employee_idx
  ON public.hr_payroll_movements (employee_id, movement_date DESC);

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_movements ENABLE ROW LEVEL SECURITY;

-- hr_employees
DROP POLICY IF EXISTS hr_employees_select ON public.hr_employees;
DROP POLICY IF EXISTS hr_employees_insert ON public.hr_employees;
DROP POLICY IF EXISTS hr_employees_update ON public.hr_employees;
DROP POLICY IF EXISTS hr_employees_delete ON public.hr_employees;

CREATE POLICY hr_employees_select ON public.hr_employees FOR SELECT TO authenticated
  USING (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_employees_insert ON public.hr_employees FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_employees_update ON public.hr_employees FOR UPDATE TO authenticated
  USING (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_employees_delete ON public.hr_employees FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- hr_employee_leaves
DROP POLICY IF EXISTS hr_employee_leaves_select ON public.hr_employee_leaves;
DROP POLICY IF EXISTS hr_employee_leaves_insert ON public.hr_employee_leaves;
DROP POLICY IF EXISTS hr_employee_leaves_update ON public.hr_employee_leaves;
DROP POLICY IF EXISTS hr_employee_leaves_delete ON public.hr_employee_leaves;

CREATE POLICY hr_employee_leaves_select ON public.hr_employee_leaves FOR SELECT TO authenticated
  USING (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_employee_leaves_insert ON public.hr_employee_leaves FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_employee_leaves_update ON public.hr_employee_leaves FOR UPDATE TO authenticated
  USING (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_employee_leaves_delete ON public.hr_employee_leaves FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- hr_payroll_movements
DROP POLICY IF EXISTS hr_payroll_movements_select ON public.hr_payroll_movements;
DROP POLICY IF EXISTS hr_payroll_movements_insert ON public.hr_payroll_movements;
DROP POLICY IF EXISTS hr_payroll_movements_update ON public.hr_payroll_movements;
DROP POLICY IF EXISTS hr_payroll_movements_delete ON public.hr_payroll_movements;

CREATE POLICY hr_payroll_movements_select ON public.hr_payroll_movements FOR SELECT TO authenticated
  USING (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_payroll_movements_insert ON public.hr_payroll_movements FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_payroll_movements_update ON public.hr_payroll_movements FOR UPDATE TO authenticated
  USING (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY hr_payroll_movements_delete ON public.hr_payroll_movements FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- Contrats employés (PDF)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-contracts', 'hr-contracts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS hr_contracts_select ON storage.objects;
DROP POLICY IF EXISTS hr_contracts_insert ON storage.objects;
DROP POLICY IF EXISTS hr_contracts_delete ON storage.objects;

CREATE POLICY hr_contracts_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'hr-contracts'
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY hr_contracts_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hr-contracts'
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY hr_contracts_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );
