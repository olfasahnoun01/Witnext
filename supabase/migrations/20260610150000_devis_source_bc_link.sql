-- BL vente → BC source link (used by bonLivraisonService and flux suivi)

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS source_bc_id bigint REFERENCES public.devis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_bc_ids jsonb;

CREATE INDEX IF NOT EXISTS idx_devis_source_bc_id
  ON public.devis (source_bc_id)
  WHERE source_bc_id IS NOT NULL;

COMMENT ON COLUMN public.devis.source_bc_id IS 'BC client source when is_bl=true (bon de livraison vente).';
COMMENT ON COLUMN public.devis.source_bc_ids IS 'BC clients fusionnés pour un BL unique.';
