-- Remaining audit fixes: atomic stock, dashboard RPC, notifications, finance bootstrap,
-- storage section scoping, inventory restore RPC, transaction integrity.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_app_section(p_section_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_section_permissions usp
      WHERE usp.user_id = auth.uid()
        AND usp.section_key = p_section_key
    );
$$;

REVOKE ALL ON FUNCTION public.user_has_app_section(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_app_section(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_inventory_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.is_inventory_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_inventory_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.allow_product_quantity_write()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.allow_stock_qty', '1', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_direct_quantity_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    IF current_setting('app.allow_stock_qty', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'quantity changes must use create_stock_transaction RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_prevent_direct_qty ON public.products;
CREATE TRIGGER products_prevent_direct_qty
  BEFORE UPDATE OF quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_quantity_update();

-- ---------------------------------------------------------------------------
-- Atomic stock RPCs
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

  SELECT quantity INTO v_current
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

  INSERT INTO public.transactions (product_id, product_name, type, quantity, date, note)
  VALUES (p_product_id, p_product_name, p_type, p_quantity, p_date, COALESCE(p_note, ''))
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

  -- Revert old movement
  IF v_tx.type = 'IN' THEN
    v_current := v_current - v_tx.quantity;
  ELSIF v_tx.type = 'OUT' THEN
    v_current := v_current + v_tx.quantity;
  ELSE
    v_current := 0;
  END IF;

  -- Apply new movement
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
  UPDATE public.transactions
  SET quantity = p_quantity, note = COALESCE(p_note, note)
  WHERE id = p_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_stock_transaction(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_stock_transaction(integer, integer, text) TO authenticated;

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
    RAISE EXCEPTION 'cannot delete transaction: stock would become negative';
  END IF;

  PERFORM public.allow_product_quantity_write();
  UPDATE public.products SET quantity = v_new WHERE id = v_tx.product_id;
  DELETE FROM public.transactions WHERE id = p_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_stock_transaction(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_stock_transaction(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard stats RPC (explicit; surfaces errors to client)
-- Remote may have an older signature (e.g. RETURNS json) — drop before replace.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_dashboard_stats();

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
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
  FROM public.products;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', category,
        'value', cat_value
      )
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

REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin-only inventory clear before restore (never touches auth / chat tables)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_inventory_clear_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_inventory_admin() THEN
    RAISE EXCEPTION 'admin required for inventory restore';
  END IF;

  DELETE FROM public.transactions;
  DELETE FROM public.product_group_fournisseurs;
  DELETE FROM public.products;
  DELETE FROM public.product_groups;
  DELETE FROM public.documents;
  DELETE FROM public.devis;
  DELETE FROM public.orders;
  DELETE FROM public.clients;
  DELETE FROM public.fournisseurs;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_inventory_clear_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_inventory_clear_tables() TO authenticated;

-- ---------------------------------------------------------------------------
-- Finance bootstrap: remove blanket grants to all profiles
-- ---------------------------------------------------------------------------
DELETE FROM public.user_section_permissions usp
WHERE usp.section_key = 'finance'
  AND usp.subsection_key = 'finance-hub'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = usp.user_id
      AND ur.role IN ('admin'::public.app_role, 'moderator'::public.app_role)
  );

DELETE FROM public.user_companies uc
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = uc.user_id
    AND ur.role IN ('admin'::public.app_role, 'moderator'::public.app_role)
)
AND NOT EXISTS (
  SELECT 1 FROM public.user_section_permissions usp
  WHERE usp.user_id = uc.user_id
    AND usp.section_key = 'finance'
);

-- ---------------------------------------------------------------------------
-- Notifications: staff-only directory & dispatch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_notification_directory()
RETURNS TABLE(user_id uuid, full_name text, user_position text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_section_permissions usp WHERE usp.user_id = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text,
    coalesce(u.raw_user_meta_data->>'position', '')::text AS user_position
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_notifications(
  p_recipient_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link_tab text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_section_permissions usp WHERE usp.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'not allowed to dispatch notifications';
  END IF;
  IF p_recipient_user_ids IS NULL OR array_length(p_recipient_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.user_notifications (
    user_id, type, title, body, link_tab, entity_type, entity_id, metadata, created_by
  )
  SELECT
    r.uid,
    p_type,
    p_title,
    p_body,
    p_link_tab,
    p_entity_type,
    p_entity_id,
    p_metadata,
    auth.uid()
  FROM unnest(p_recipient_user_ids) AS r(uid)
  WHERE r.uid IS NOT NULL
    AND r.uid <> auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_notifications un
      WHERE un.user_id = r.uid
        AND un.type = p_type
        AND un.entity_type IS NOT DISTINCT FROM p_entity_type
        AND un.entity_id IS NOT DISTINCT FROM p_entity_id
        AND un.entity_id IS NOT NULL
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Storage: section-scoped access (replaces bucket-wide authenticated write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "fiches_techniques_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "fiches_techniques_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "fiches_techniques_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "fiches_techniques_delete_staff" ON storage.objects;

CREATE POLICY "fiches_techniques_select_section"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fiches-techniques'
    AND (
      public.user_has_app_section('magasin')
      OR public.user_has_app_section('ventes')
    )
  );

CREATE POLICY "fiches_techniques_insert_section"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fiches-techniques'
    AND (
      public.user_has_app_section('magasin')
      OR public.user_has_app_section('ventes')
    )
  );

CREATE POLICY "fiches_techniques_update_section"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fiches-techniques'
    AND (
      public.user_has_app_section('magasin')
      OR public.user_has_app_section('ventes')
    )
  );

CREATE POLICY "fiches_techniques_delete_staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fiches-techniques'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "client_documents_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "client_documents_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "client_documents_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "client_documents_delete_staff" ON storage.objects;

CREATE POLICY "client_documents_select_section"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND public.user_has_app_section('ventes')
  );

CREATE POLICY "client_documents_insert_section"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND public.user_has_app_section('ventes')
  );

CREATE POLICY "client_documents_update_section"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND public.user_has_app_section('ventes')
  );

CREATE POLICY "client_documents_delete_staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "product_documents_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "product_documents_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "product_documents_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "product_documents_delete_staff" ON storage.objects;

CREATE POLICY "product_documents_select_section"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-documents'
    AND (
      public.user_has_app_section('magasin')
      OR public.user_has_app_section('achats')
    )
  );

CREATE POLICY "product_documents_insert_section"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-documents'
    AND (
      public.user_has_app_section('magasin')
      OR public.user_has_app_section('achats')
    )
  );

CREATE POLICY "product_documents_update_section"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-documents'
    AND (
      public.user_has_app_section('magasin')
      OR public.user_has_app_section('achats')
    )
  );

CREATE POLICY "product_documents_delete_staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-documents'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

-- When Finance section is granted explicitly, link user to default company (not all users)
CREATE OR REPLACE FUNCTION public.sync_finance_company_on_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.section_key = 'finance' THEN
    INSERT INTO public.user_companies (user_id, company_id)
    SELECT NEW.user_id, c.id
    FROM public.companies c
    WHERE c.code = 'grosafe'
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_section_permissions_finance_company ON public.user_section_permissions;
CREATE TRIGGER user_section_permissions_finance_company
  AFTER INSERT ON public.user_section_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_finance_company_on_permission();

-- gallery-photos (commercial gallery — ventes section)
DROP POLICY IF EXISTS "gallery_photos_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "gallery_photos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "gallery_photos_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "gallery_photos_delete_staff" ON storage.objects;

CREATE POLICY "gallery_photos_select_section"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'gallery-photos' AND public.user_has_app_section('ventes'));

CREATE POLICY "gallery_photos_insert_section"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery-photos' AND public.user_has_app_section('ventes'));

CREATE POLICY "gallery_photos_update_section"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery-photos' AND public.user_has_app_section('ventes'));

CREATE POLICY "gallery_photos_delete_staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery-photos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
