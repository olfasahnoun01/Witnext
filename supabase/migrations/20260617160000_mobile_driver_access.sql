-- Mobile driver app: read own employee row + assigned fuel vouchers (no RH / ERP section required).

-- Link employees by auth user id as well as email (used by current_employee_ids).
CREATE OR REPLACE FUNCTION public.current_employee_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.user_id = auth.uid()
     OR (
       e.email IS NOT NULL
       AND lower(trim(e.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
     );
$$;

REVOKE ALL ON FUNCTION public.current_employee_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_employee_ids() TO authenticated;

-- Chauffeurs / opérateurs: read their own row without RH section.
DROP POLICY IF EXISTS employees_driver_self_select ON public.employees;
CREATE POLICY employees_driver_self_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      email IS NOT NULL
      AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );

-- Assigned bons carburant: drivers without user_companies / vehicules section.
DROP POLICY IF EXISTS fuel_vouchers_driver_select ON public.fuel_vouchers;
CREATE POLICY fuel_vouchers_driver_select ON public.fuel_vouchers
  FOR SELECT TO authenticated
  USING (
    conducteur_id IN (SELECT public.current_employee_ids())
  );

DROP POLICY IF EXISTS fuel_vouchers_driver_update ON public.fuel_vouchers;
CREATE POLICY fuel_vouchers_driver_update ON public.fuel_vouchers
  FOR UPDATE TO authenticated
  USING (
    conducteur_id IN (SELECT public.current_employee_ids())
  )
  WITH CHECK (
    conducteur_id IN (SELECT public.current_employee_ids())
  );
