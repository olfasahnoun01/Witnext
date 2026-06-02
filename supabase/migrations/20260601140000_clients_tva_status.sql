-- Statut TVA obligatoire sur les clients (assujetti vs exonéré).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tva_status text;

-- Backfill existing rows as assujetti (standard commercial default).
UPDATE public.clients
SET tva_status = 'assujetti'
WHERE tva_status IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN tva_status SET DEFAULT 'assujetti';

ALTER TABLE public.clients
  ADD CONSTRAINT clients_tva_status_check
  CHECK (tva_status IN ('assujetti', 'exonere'));

ALTER TABLE public.clients
  ALTER COLUMN tva_status SET NOT NULL;

COMMENT ON COLUMN public.clients.tva_status IS
  'assujetti = assujetti à la TVA ; exonere = exonéré de TVA';
