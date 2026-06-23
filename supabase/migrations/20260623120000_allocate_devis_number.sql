-- Atomic per-company commercial document numbering (devis / BC / BA prefixes in devis.devis_number).

CREATE OR REPLACE FUNCTION public.allocate_devis_number(
  p_company_id uuid,
  p_prefix text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int := 0;
  v_num text;
  v_lock_key bigint;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for devis numbering';
  END IF;

  IF p_prefix IS NULL OR p_prefix !~ '^[A-Z0-9]{2,4}$' THEN
    RAISE EXCEPTION 'invalid devis number prefix: %', p_prefix;
  END IF;

  v_lock_key := hashtext(p_company_id::text || ':' || p_prefix);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(
    substring(d.devis_number from '^' || p_prefix || '-(\d+)$')::int
  ), 0)
  INTO v_max
  FROM public.devis d
  WHERE d.company_id = p_company_id
    AND d.devis_number ~ ('^' || p_prefix || '-\d+$');

  v_num := p_prefix || '-' || lpad((v_max + 1)::text, 2, '0');
  RETURN v_num;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_devis_number(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_devis_number(uuid, text) TO authenticated;
