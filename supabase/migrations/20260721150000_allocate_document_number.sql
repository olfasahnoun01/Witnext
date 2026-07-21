-- Atomic per-company numbering for unified documents (BLF, BE, BS, …).
-- Format: PREFIX-YEAR-SEQ (e.g. BLF-2026-001). Uses max(seq)+1, not count,
-- so deleted docs no longer cause duplicate-key collisions on insert.

CREATE OR REPLACE FUNCTION public.allocate_document_number(
  p_company_id uuid,
  p_prefix text,
  p_year integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_max int := 0;
  v_next int;
  v_pad int := 3;
  v_lock_key bigint;
  v_pattern text;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for document numbering';
  END IF;

  IF p_prefix IS NULL OR p_prefix !~ '^[A-Z0-9]{1,8}$' THEN
    RAISE EXCEPTION 'invalid document number prefix: %', p_prefix;
  END IF;

  v_year := COALESCE(p_year, EXTRACT(YEAR FROM now())::int);
  v_pattern := '^' || p_prefix || '-' || v_year::text || '-(\d+)$';

  -- Serialize concurrent allocates for the same company + prefix + year.
  v_lock_key := hashtext(p_company_id::text || ':' || p_prefix || ':' || v_year::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(
    substring(d.numero from v_pattern)::int
  ), 0)
  INTO v_max
  FROM public.documents d
  WHERE (d.company_id = p_company_id OR d.company_id IS NULL)
    AND d.numero ~ v_pattern;

  v_next := v_max + 1;
  IF v_next >= 1000 THEN
    v_pad := length(v_next::text);
  END IF;

  RETURN p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, v_pad, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_document_number(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_document_number(uuid, text, integer) TO authenticated;
