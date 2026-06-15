-- Statut TVA obligatoire sur les fournisseurs (assujetti vs exonéré).
ALTER TABLE public.fournisseurs
  ADD COLUMN IF NOT EXISTS tva_status text;

UPDATE public.fournisseurs
SET tva_status = 'assujetti'
WHERE tva_status IS NULL;

ALTER TABLE public.fournisseurs
  ALTER COLUMN tva_status SET DEFAULT 'assujetti';

ALTER TABLE public.fournisseurs
  ADD CONSTRAINT fournisseurs_tva_status_check
  CHECK (tva_status IN ('assujetti', 'exonere'));

ALTER TABLE public.fournisseurs
  ALTER COLUMN tva_status SET NOT NULL;

COMMENT ON COLUMN public.fournisseurs.tva_status IS
  'assujetti = assujetti à la TVA ; exonere = exonéré de TVA';
