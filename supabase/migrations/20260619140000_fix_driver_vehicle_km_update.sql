-- Fix driver vehicle kilometrage update permission
CREATE OR REPLACE FUNCTION public.update_vehicle_kilometrage_actuel(
  p_vehicle_id uuid,
  p_km numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  
  IF p_km IS NULL OR p_km < 0 THEN
    RAISE EXCEPTION 'invalid kilometrage';
  END IF;

  -- 1. Check if user is a manager with 'vehicules' access and belongs to the vehicle's company
  IF public.user_has_any_app_section(ARRAY['vehicules']::text[]) THEN
    IF EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = p_vehicle_id
        AND v.company_id IN (SELECT public.user_company_ids())
    ) THEN
      v_authorized := true;
    END IF;
  END IF;

  -- 2. Check if user is the assigned driver on a fuel voucher for this vehicle
  IF NOT v_authorized THEN
    IF EXISTS (
      SELECT 1 FROM public.fuel_vouchers
      WHERE vehicule_id = p_vehicle_id
        AND conducteur_id IN (SELECT public.current_employee_ids())
    ) THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.vehicles v
  SET kilometrage_actuel = p_km,
      updated_at = timezone('utc'::text, now())
  WHERE v.id = p_vehicle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle not found';
  END IF;
END;
$$;
