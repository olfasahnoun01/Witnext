-- Galerie commerciale : prix d'achat et fichiers devis (fournisseur)
ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS prix_achat_ttc numeric(14, 3),
  ADD COLUMN IF NOT EXISTS devis_fichiers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.gallery_items.prix_achat_ttc IS 'Prix d''achat TTC (TND) — usage interne / marge';
COMMENT ON COLUMN public.gallery_items.devis_fichiers IS 'Liste JSON d''URLs de devis fournisseur (PDF, images)';
