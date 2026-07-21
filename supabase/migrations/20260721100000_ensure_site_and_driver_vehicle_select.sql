-- Drivers: free-text sites (ensure) + read assigned fleet vehicle on profile.
-- Mirrors fuel-driver-mobile-app migration 005.

CREATE OR REPLACE FUNCTION public.get_employee_id_for_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.user_id = auth.uid()
     OR (
       auth.jwt() ->> 'email' IS NOT NULL
       AND lower(trim(e.email)) = lower(trim(auth.jwt() ->> 'email'))
     )
  ORDER BY (e.user_id = auth.uid()) DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.ensure_site(p_nom text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nom text := nullif(trim(p_nom), '');
  v_id uuid;
BEGIN
  IF v_nom IS NULL THEN
    RAISE EXCEPTION 'Nom de site requis';
  END IF;

  SELECT s.id INTO v_id
  FROM public.sites s
  WHERE lower(s.nom) = lower(v_nom)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.sites SET actif = true WHERE id = v_id AND actif IS DISTINCT FROM true;
    RETURN v_id;
  END IF;

  INSERT INTO public.sites (nom, actif)
  VALUES (v_nom, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_site(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_site(text) TO authenticated;

DROP POLICY IF EXISTS vehicles_driver_select_assigned ON public.vehicles;
CREATE POLICY vehicles_driver_select_assigned ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    conducteur_id IS NOT NULL
    AND conducteur_id = public.get_employee_id_for_user()
  );

NOTIFY pgrst, 'reload schema';
