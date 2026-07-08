-- Fix devis numbering: include legacy rows (company_id IS NULL) when computing
-- the next sequence, and enforce uniqueness per company instead of globally.

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
  v_pad int := 2;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for devis numbering';
  END IF;

  IF p_prefix IS NULL OR p_prefix !~ '^[A-Z0-9]{2,4}$' THEN
    RAISE EXCEPTION 'invalid devis number prefix: %', p_prefix;
  END IF;

  -- Lock per company + prefix so concurrent creates cannot get the same next number.
  v_lock_key := hashtext(p_company_id::text || ':' || p_prefix);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Max across all companies / null: until uniqueness is strictly per-company,
  -- re-using another company's (or legacy) number still fails the global unique.
  -- After devis_company_devis_number_uniq is the only constraint, this remains
  -- safe (sequences just grow globally for that prefix).
  SELECT COALESCE(MAX(
    substring(d.devis_number from '^' || p_prefix || '-(\d+)$')::int
  ), 0)
  INTO v_max
  FROM public.devis d
  WHERE d.devis_number ~ ('^' || p_prefix || '-\d+$');

  -- Keep at least 2 digits; grow padding as sequence grows (DS-99 → DS-100).
  IF v_max + 1 >= 100 THEN
    v_pad := length((v_max + 1)::text);
  END IF;

  v_num := p_prefix || '-' || lpad((v_max + 1)::text, v_pad, '0');
  RETURN v_num;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_devis_number(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_devis_number(uuid, text) TO authenticated;

-- Convert global unique(devis_number) → unique(company_id, devis_number).
DO $$
DECLARE
  r record;
BEGIN
  -- Drop single-column unique constraints on devis_number.
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'devis'
      AND con.contype = 'u'
      AND con.conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = rel.oid AND attname = 'devis_number'
      )]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.devis DROP CONSTRAINT %I', r.conname);
  END LOOP;

  -- Drop unique indexes covering only devis_number (e.g. devis_devis_number_uk).
  FOR r IN
    SELECT i.relname AS idxname
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE ns.nspname = 'public'
      AND t.relname = 'devis'
      AND idx.indisunique
      AND NOT idx.indisprimary
      AND idx.indnatts = 1
      AND idx.indkey[0] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = t.oid AND attname = 'devis_number'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.idxname);
  END LOOP;

  CREATE UNIQUE INDEX IF NOT EXISTS devis_company_devis_number_uniq
    ON public.devis (company_id, devis_number);
END $$;
