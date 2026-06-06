-- =============================================================================
-- MULTI-COMPANY: company-aware RPCs (Phase 4)
--
--   * create_stock_transaction stamps transactions.company_id from the product
--     (RLS on products already restricts the lookup to the caller's companies).
--   * get_dashboard_stats(p_company_id) scopes aggregates to one company.
--   * restore_inventory_clear_tables(p_company_id) only clears that company.
--   * update_product_fiche_technique verifies the product is in the caller's
--     companies (it is SECURITY DEFINER and bypasses RLS).
--
-- update/delete_stock_transaction stay SECURITY INVOKER: RLS on transactions
-- and products already enforces isolation, so no signature change is needed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_stock_transaction: stamp company_id from the (RLS-filtered) product.
-- -----------------------------------------------------------------------------
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

  -- RLS limits this SELECT to products the caller's companies own.
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

REVOKE ALL ON FUNCTION public.create_stock_transaction(integer, text, text, integer, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_transaction(integer, text, text, integer, timestamptz, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- get_dashboard_stats(p_company_id): scope all aggregates to one company.
-- RLS already restricts to the caller's companies; the param narrows to the
-- currently selected one. Drop old signature first.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total_value numeric := 0;
  v_total_products integer := 0;
  v_low_stock integer := 0;
  v_out_of_stock integer := 0;
  v_category_values jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT
    coalesce(sum(price * (1 - coalesce(remise, 0) / 100.0) * quantity), 0),
    count(*)::integer,
    count(*) FILTER (WHERE quantity > 0 AND quantity <= min_stock)::integer,
    count(*) FILTER (WHERE quantity <= 0)::integer
  INTO v_total_value, v_total_products, v_low_stock, v_out_of_stock
  FROM public.products
  WHERE (p_company_id IS NULL OR company_id = p_company_id);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('category', category, 'value', cat_value)
      ORDER BY category
    ),
    '[]'::jsonb
  )
  INTO v_category_values
  FROM (
    SELECT
      category,
      coalesce(sum(price * (1 - coalesce(remise, 0) / 100.0) * quantity), 0) AS cat_value
    FROM public.products
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
    GROUP BY category
  ) c;

  RETURN jsonb_build_object(
    'totalValue', v_total_value,
    'totalProducts', v_total_products,
    'lowStockCount', v_low_stock,
    'outOfStockCount', v_out_of_stock,
    'categoryValues', v_category_values
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- restore_inventory_clear_tables(p_company_id): only clear that company's data.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.restore_inventory_clear_tables();
DROP FUNCTION IF EXISTS public.restore_inventory_clear_tables(uuid);

CREATE OR REPLACE FUNCTION public.restore_inventory_clear_tables(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_inventory_admin() THEN
    RAISE EXCEPTION 'admin required for inventory restore';
  END IF;
  IF p_company_id IS NULL OR NOT public.user_in_company(p_company_id) THEN
    RAISE EXCEPTION 'invalid or unauthorized company';
  END IF;

  DELETE FROM public.transactions WHERE company_id = p_company_id;
  DELETE FROM public.product_group_fournisseurs pgf
    USING public.product_groups pg
    WHERE pgf.product_group_id = pg.id AND pg.company_id = p_company_id;
  DELETE FROM public.products WHERE company_id = p_company_id;
  DELETE FROM public.product_groups WHERE company_id = p_company_id;
  DELETE FROM public.documents WHERE company_id = p_company_id;
  DELETE FROM public.devis WHERE company_id = p_company_id;
  DELETE FROM public.orders WHERE company_id = p_company_id;
  DELETE FROM public.clients WHERE company_id = p_company_id;
  DELETE FROM public.fournisseurs WHERE company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_inventory_clear_tables(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_inventory_clear_tables(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- update_product_fiche_technique: verify the product is in the caller's company.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_product_fiche_technique(_product_id integer, _fiche_technique_url text DEFAULT ''::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = _product_id
      AND p.company_id IN (SELECT public.user_company_ids())
  ) THEN
    RAISE EXCEPTION 'product not found in your companies';
  END IF;

  UPDATE products
  SET fiche_technique_url = NULLIF(_fiche_technique_url, ''),
      updated_at = now()
  WHERE id = _product_id;
END;
$function$;
