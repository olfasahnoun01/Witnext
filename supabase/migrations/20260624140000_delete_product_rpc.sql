-- =============================================================================
-- Product deletion: detach stock ledger before delete.
-- Direct DELETE on products fails because ON DELETE SET NULL on transactions
-- is blocked by transactions_prevent_direct_write unless the stock flag is set.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  PERFORM public.allow_stock_transaction_write();
  UPDATE public.transactions
  SET product_id = NULL
  WHERE product_id = p_product_id;

  DELETE FROM public.products WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_product_group(p_group_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_deleted_products integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.product_groups WHERE id = p_group_id) THEN
    RAISE EXCEPTION 'product group not found';
  END IF;

  PERFORM public.allow_stock_transaction_write();
  UPDATE public.transactions t
  SET product_id = NULL
  FROM public.products p
  WHERE t.product_id = p.id
    AND p.product_group_id = p_group_id;

  DELETE FROM public.products WHERE product_group_id = p_group_id;
  GET DIAGNOSTICS v_deleted_products = ROW_COUNT;

  DELETE FROM public.product_group_fournisseurs WHERE product_group_id = p_group_id;
  DELETE FROM public.product_groups WHERE id = p_group_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_products', v_deleted_products
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_product(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_product_group(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product_group(integer) TO authenticated;
