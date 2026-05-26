-- WooCommerce sync keys for Galerie commerciale (upsert on re-import)
ALTER TABLE public.gallery_categories
  ADD COLUMN IF NOT EXISTS woocommerce_id bigint;

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS woocommerce_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS gallery_categories_woocommerce_id_key
  ON public.gallery_categories (woocommerce_id)
  WHERE woocommerce_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gallery_items_woocommerce_id_key
  ON public.gallery_items (woocommerce_id)
  WHERE woocommerce_id IS NOT NULL;

COMMENT ON COLUMN public.gallery_categories.woocommerce_id IS 'WooCommerce category id for sync';
COMMENT ON COLUMN public.gallery_items.woocommerce_id IS 'WooCommerce product id for sync';
