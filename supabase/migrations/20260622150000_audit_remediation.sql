-- =============================================================================
-- Audit remediation: stock integrity, BE/BS validation, transaction guards,
-- company defaults, factures per-company unique, document line validation,
-- user_presence scoping.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Session flag + trigger: block direct writes to transactions table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allow_stock_transaction_write()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.allow_stock_tx', '1', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_direct_transaction_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_stock_tx', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'stock ledger changes must use stock RPCs or validated BE/BS documents';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_prevent_direct_write ON public.transactions;
CREATE TRIGGER transactions_prevent_direct_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_transaction_write();

-- ---------------------------------------------------------------------------
-- 2. Block products INSERT with quantity > 0 unless stock RPC path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_initial_quantity_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.quantity, 0) > 0
     AND current_setting('app.allow_stock_qty', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'initial stock must use create_stock_transaction RPC (insert product with quantity 0)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_prevent_initial_qty ON public.products;
CREATE TRIGGER products_prevent_initial_qty
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_initial_quantity_on_insert();

-- ---------------------------------------------------------------------------
-- 3. Patch stock RPCs to set transaction-write flag
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_transaction(
  p_product_id integer,
  p_product_name text,
  p_type text,
  p_quantity integer,
  p_date timestamptz DEFAULT now(),
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_new integer;
  v_tx_id integer;
  v_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;
  IF p_type NOT IN ('IN', 'OUT', 'ADJUSTMENT') THEN
    RAISE EXCEPTION 'invalid transaction type';
  END IF;

  SELECT quantity, company_id INTO v_current, v_company
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  IF p_type = 'IN' THEN
    v_new := v_current + p_quantity;
  ELSIF p_type = 'OUT' THEN
    v_new := v_current - p_quantity;
    IF v_new < 0 THEN
      RAISE EXCEPTION 'insufficient stock';
    END IF;
  ELSE
    v_new := p_quantity;
  END IF;

  PERFORM public.allow_product_quantity_write();
  UPDATE public.products SET quantity = v_new WHERE id = p_product_id;

  PERFORM public.allow_stock_transaction_write();
  INSERT INTO public.transactions (product_id, product_name, type, quantity, date, note, company_id)
  VALUES (p_product_id, p_product_name, p_type, p_quantity, p_date, COALESCE(p_note, ''), v_company)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_quantity', v_new
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stock_transaction(
  p_transaction_id integer,
  p_quantity integer,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_current integer;
  v_new integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;

  SELECT quantity INTO v_current FROM public.products WHERE id = v_tx.product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  IF v_tx.type = 'IN' THEN
    v_current := v_current - v_tx.quantity;
  ELSIF v_tx.type = 'OUT' THEN
    v_current := v_current + v_tx.quantity;
  ELSE
    v_current := 0;
  END IF;

  IF v_tx.type = 'IN' THEN
    v_new := v_current + p_quantity;
  ELSIF v_tx.type = 'OUT' THEN
    v_new := v_current - p_quantity;
    IF v_new < 0 THEN
      RAISE EXCEPTION 'insufficient stock';
    END IF;
  ELSE
    v_new := p_quantity;
  END IF;

  PERFORM public.allow_product_quantity_write();
  UPDATE public.products SET quantity = v_new WHERE id = v_tx.product_id;

  PERFORM public.allow_stock_transaction_write();
  UPDATE public.transactions
  SET quantity = p_quantity, note = COALESCE(p_note, note)
  WHERE id = p_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_stock_transaction(p_transaction_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_current integer;
  v_new integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;

  SELECT quantity INTO v_current FROM public.products WHERE id = v_tx.product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  IF v_tx.type = 'IN' THEN
    v_new := v_current - v_tx.quantity;
  ELSIF v_tx.type = 'OUT' THEN
    v_new := v_current + v_tx.quantity;
  ELSE
    v_new := v_current;
  END IF;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'insufficient stock to reverse transaction';
  END IF;

  PERFORM public.allow_product_quantity_write();
  UPDATE public.products SET quantity = v_new WHERE id = v_tx.product_id;

  PERFORM public.allow_stock_transaction_write();
  DELETE FROM public.transactions WHERE id = p_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_transaction(integer, text, text, integer, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_transaction(integer, text, text, integer, timestamptz, text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_stock_transaction(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_stock_transaction(integer, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_stock_transaction(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_stock_transaction(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. BE/BS validation: apply stock when VALIDATED (skip if linked to manual tx)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_apply_be_bs_stock_on_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
  v_tx_type text;
  v_note text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'VALIDATED' OR NEW.type NOT IN ('BE', 'BS') THEN
    RETURN NEW;
  END IF;

  -- Stock already moved via magasin Transactions flow (documentation-only BE/BS)
  IF COALESCE(NEW.metadata->>'transaction_id', '') <> ''
     OR NEW.metadata->>'source' = 'stock_transaction' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.metadata->>'stock_applied', '') = 'true' THEN
    RETURN NEW;
  END IF;

  v_tx_type := CASE WHEN NEW.type = 'BE' THEN 'IN' ELSE 'OUT' END;
  v_note := format('Validation %s %s', NEW.type, COALESCE(NEW.numero, NEW.id::text));

  FOR v_line IN
    SELECT dl.product_id, dl.quantity, p.name AS product_name
    FROM public.document_lines dl
    INNER JOIN public.products p
      ON p.id = dl.product_id AND p.company_id = NEW.company_id
    WHERE dl.document_id = NEW.id
      AND dl.product_id IS NOT NULL
      AND dl.quantity > 0
  LOOP
    PERFORM public.create_stock_transaction(
      v_line.product_id,
      v_line.product_name,
      v_tx_type,
      v_line.quantity,
      now(),
      v_note
    );
  END LOOP;

  UPDATE public.documents
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('stock_applied', true)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_be_bs_validation ON public.documents;
CREATE TRIGGER trigger_be_bs_validation
  AFTER UPDATE OF status ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_apply_be_bs_stock_on_validation();

-- ---------------------------------------------------------------------------
-- 5. document_lines: product must belong to same company as parent document
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_document_line_product_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_company uuid;
  v_prod_company uuid;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_id INTO v_doc_company FROM public.documents WHERE id = NEW.document_id;
  SELECT company_id INTO v_prod_company FROM public.products WHERE id = NEW.product_id;

  IF v_doc_company IS NULL THEN
    RAISE EXCEPTION 'parent document not found';
  END IF;
  IF v_prod_company IS NULL THEN
    RAISE EXCEPTION 'product not found';
  END IF;
  IF v_doc_company IS DISTINCT FROM v_prod_company THEN
    RAISE EXCEPTION 'product does not belong to the same company as the document';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_lines_validate_product_company ON public.document_lines;
CREATE TRIGGER document_lines_validate_product_company
  BEFORE INSERT OR UPDATE OF product_id, document_id ON public.document_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_document_line_product_company();

-- ---------------------------------------------------------------------------
-- 6. Multi-company: require explicit company_id when user belongs to >1 company
-- ---------------------------------------------------------------------------
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
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer, (array_agg(company_id ORDER BY company_id))[1]
  INTO v_count, v_single
  FROM public.user_companies
  WHERE user_id = auth.uid();

  IF v_count = 1 THEN
    NEW.company_id := v_single;
    RETURN NEW;
  END IF;

  IF v_count = 0 THEN
    NEW.company_id := public.grosafe_company_id();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'company_id is required: select an active company before creating this record';
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. factures.numero: per-company uniqueness
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.factures') IS NOT NULL THEN
    PERFORM public.mc_make_company_unique('factures', 'numero');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. product_groups backup upsert: per-company unique (name, category)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.product_groups') IS NOT NULL THEN
  -- Drop legacy global unique if mc_make_company_unique only handled single column
    BEGIN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS product_groups_company_name_category_uniq
        ON public.product_groups (company_id, name, category)';
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. user_presence: limit SELECT to shared companies (not org-wide)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_presence_select_authenticated_all" ON public.user_presence;
DROP POLICY IF EXISTS user_presence_select_authenticated_all ON public.user_presence;

CREATE POLICY user_presence_select_company_peers ON public.user_presence
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.user_companies uc_self
      JOIN public.user_companies uc_peer ON uc_peer.company_id = uc_self.company_id
      WHERE uc_self.user_id = auth.uid()
        AND uc_peer.user_id = user_presence.user_id
    )
  );

-- ---------------------------------------------------------------------------
-- 10. documents: validate stock_transaction metadata links a real transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_document_stock_transaction_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id integer;
  v_tx_company uuid;
BEGIN
  IF NEW.metadata->>'source' IS DISTINCT FROM 'stock_transaction' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.metadata->>'transaction_id', '') = '' THEN
    RETURN NEW;
  END IF;

  v_tx_id := (NEW.metadata->>'transaction_id')::integer;

  SELECT company_id INTO v_tx_company
  FROM public.transactions
  WHERE id = v_tx_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'linked transaction_id % not found', v_tx_id;
  END IF;

  IF v_tx_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'linked transaction does not belong to the document company';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_validate_stock_transaction_link ON public.documents;
CREATE TRIGGER documents_validate_stock_transaction_link
  BEFORE INSERT OR UPDATE OF metadata, company_id ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_document_stock_transaction_link();
