
CREATE OR REPLACE FUNCTION public.update_product_fiche_technique(
  _product_id integer,
  _fiche_technique_url text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE products
  SET fiche_technique_url = NULLIF(_fiche_technique_url, ''),
      updated_at = now()
  WHERE id = _product_id;
END;
$$;
