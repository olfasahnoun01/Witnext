-- PostgreSQL has no min()/max() for uuid; the default-company trigger failed on INSERT
-- (e.g. fuel_vouchers) with "function min(uuid) does not exist".
CREATE OR REPLACE FUNCTION public.set_company_id_default_grosafe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_single uuid;
  v_count integer;
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT count(*)::integer, (array_agg(company_id ORDER BY company_id))[1]
    INTO v_count, v_single
    FROM public.user_companies
    WHERE user_id = auth.uid();

    IF v_count <> 1 THEN
      v_single := NULL;
    END IF;

    NEW.company_id := COALESCE(v_single, public.grosafe_company_id());
  END IF;
  RETURN NEW;
END;
$$;
