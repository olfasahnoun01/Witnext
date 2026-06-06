-- =============================================================================
-- MULTI-COMPANY: per-company uniqueness (Phase 7, DB part)
--
-- Global unique keys would make the same code/matricule impossible across two
-- companies. Convert them to composite (company_id, <col>) uniques so each
-- company has its own namespace.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mc_make_company_unique(p_table text, p_col text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;

  -- Drop any existing single-column unique constraint on p_col.
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = p_table
      AND con.contype = 'u'
      AND con.conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = rel.oid AND attname = p_col
      )]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', p_table, r.conname);
  END LOOP;

  -- Drop any unique index that covers exactly (p_col).
  FOR r IN
    SELECT i.relname AS idxname
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE ns.nspname = 'public'
      AND t.relname = p_table
      AND idx.indisunique
      AND NOT idx.indisprimary
      AND idx.indnatts = 1
      AND idx.indkey[0] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = t.oid AND attname = p_col
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.idxname);
  END LOOP;

  -- Add the composite per-company unique.
  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (company_id, %I)',
    p_table || '_company_' || p_col || '_uniq', p_table, p_col
  );
END;
$$;

DO $$
BEGIN
  PERFORM public.mc_make_company_unique('vehicles', 'matricule');
  PERFORM public.mc_make_company_unique('fuel_vouchers', 'num_bon');
  PERFORM public.mc_make_company_unique('fuel_cards', 'num_carte');
  PERFORM public.mc_make_company_unique('clients', 'code');
  PERFORM public.mc_make_company_unique('fournisseurs', 'code');
  -- Commercial document numbering is per-company (numero/devis_number can repeat
  -- across companies but must stay unique within one).
  PERFORM public.mc_make_company_unique('documents', 'numero');
END $$;
