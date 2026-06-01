-- =============================================================================
-- Data-integrity hardening (audit remediation — Batch 2)
--
-- REVIEW BEFORE APPLYING. This migration is written to be safe and mostly
-- idempotent, and it will NOT hard-fail if pre-existing duplicates are present
-- (it raises a NOTICE listing them instead). Apply against a staging copy
-- first, resolve any reported duplicates, then re-run to enforce constraints.
--
-- Scope:
--   1. Preserve stock audit trail: transactions.product_id CASCADE -> SET NULL.
--   2. Enforce unique document numbers on devis.devis_number & bons_commande.bc_number.
--   3. Add missing hot-path indexes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. transactions.product_id: stop destroying movement history on product delete
--    (CASCADE => SET NULL). product_name is already denormalised on the row, so
--    the audit trail survives even after the product is removed.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public'
    AND rel.relname = 'transactions'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) ILIKE '%product_id%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', fk_name);
  END IF;

  -- product_id must be nullable for ON DELETE SET NULL to apply.
  BEGIN
    ALTER TABLE public.transactions ALTER COLUMN product_id DROP NOT NULL;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'transactions.product_id NOT NULL drop skipped: %', SQLERRM;
  END;

  ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Unique document numbers (devis + bons_commande).
--    Guarded: if duplicates already exist, the index is NOT created and the
--    offending numbers are reported so they can be fixed first.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  dup_count integer;
  dup_list text;
BEGIN
  SELECT count(*), string_agg(devis_number, ', ')
    INTO dup_count, dup_list
  FROM (
    SELECT devis_number
    FROM public.devis
    GROUP BY devis_number
    HAVING count(*) > 1
  ) d;

  IF COALESCE(dup_count, 0) > 0 THEN
    RAISE NOTICE 'SKIP unique(devis.devis_number): % duplicate value(s): %', dup_count, dup_list;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS devis_devis_number_uk
      ON public.devis (devis_number);
  END IF;
END $$;

DO $$
DECLARE
  dup_count integer;
  dup_list text;
BEGIN
  SELECT count(*), string_agg(bc_number, ', ')
    INTO dup_count, dup_list
  FROM (
    SELECT bc_number
    FROM public.bons_commande
    GROUP BY bc_number
    HAVING count(*) > 1
  ) d;

  IF COALESCE(dup_count, 0) > 0 THEN
    RAISE NOTICE 'SKIP unique(bons_commande.bc_number): % duplicate value(s): %', dup_count, dup_list;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS bons_commande_bc_number_uk
      ON public.bons_commande (bc_number);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Missing hot-path indexes (read performance on common joins/filters).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS transactions_product_id_idx
  ON public.transactions (product_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx
  ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS documents_parent_id_idx
  ON public.documents (parent_id);
CREATE INDEX IF NOT EXISTS documents_type_status_idx
  ON public.documents (type, status);
CREATE INDEX IF NOT EXISTS document_lines_document_id_idx
  ON public.document_lines (document_id);
CREATE INDEX IF NOT EXISTS factures_source_bc_id_idx
  ON public.factures (source_bc_id);
CREATE INDEX IF NOT EXISTS products_product_group_id_idx
  ON public.products (product_group_id);
