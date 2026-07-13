-- FODEC (1 %) — some industrial products are subject to FODEC; keep HT price separate.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subject_to_fodec boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.subject_to_fodec IS
  'Produit soumis au FODEC (1 % du HT net). Le prix catalogue (price) reste HT hors FODEC.';
