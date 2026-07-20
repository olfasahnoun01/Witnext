-- Fleet module: allow vehicules users to read driver employees for bons carburant / flotte
-- without requiring RH section access.

CREATE OR REPLACE FUNCTION public.employee_is_driver(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    translate(
      coalesce(p_role, ''),
      'àáâãäåèéêëìíîïòóôõöùúûüýÿç',
      'aaaaaaeeeeiiiioooooouuuuyyc'
    )
  ) ~ '(chauffeur|conducteur|driver|operateur|chauffer)';
$$;

REVOKE ALL ON FUNCTION public.employee_is_driver(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_is_driver(text) TO authenticated;

DROP POLICY IF EXISTS employees_vehicules_driver_select ON public.employees;
CREATE POLICY employees_vehicules_driver_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
    AND public.employee_is_driver(role)
  );

NOTIFY pgrst, 'reload schema';
