-- Add remise (discount percentage) and prix_ttc (calculated total price) to products table
ALTER TABLE public.products 
ADD COLUMN remise numeric DEFAULT 0,
ADD COLUMN prix_ttc numeric GENERATED ALWAYS AS (price * (1 - remise / 100)) STORED;

-- Add comment for clarity
COMMENT ON COLUMN public.products.remise IS 'Discount percentage from supplier';
COMMENT ON COLUMN public.products.prix_ttc IS 'Final purchase price after discount (auto-calculated)';