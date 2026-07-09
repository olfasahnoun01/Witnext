-- Product barcode for label printing and scanner lookup.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode text;

CREATE INDEX IF NOT EXISTS idx_products_barcode_company
  ON public.products (company_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

COMMENT ON COLUMN public.products.barcode IS 'Code-barres EAN/Code128 pour étiquettes et scan douchette.';
