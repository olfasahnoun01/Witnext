-- Bons de livraison vente (legacy devis) + lien facture → BL

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS is_bl boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_devis_is_bl_vente
  ON public.devis (is_bl, type)
  WHERE is_bl = true;

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS source_bl_id integer REFERENCES public.devis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_bl_ids jsonb;

COMMENT ON COLUMN public.devis.is_bl IS 'Bon de livraison client (vente), étape entre BC et facture.';
COMMENT ON COLUMN public.factures.source_bl_id IS 'BL source principal (devis.is_bl=true).';
COMMENT ON COLUMN public.factures.source_bl_ids IS 'IDs des BL fusionnés pour une facture unique.';
