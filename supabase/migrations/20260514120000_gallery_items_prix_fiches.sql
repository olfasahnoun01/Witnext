-- Galerie commerciale (Ventes) : prix TTC pour réponses rapides + fiches techniques
ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS prix_vente_ttc numeric(14, 3),
  ADD COLUMN IF NOT EXISTS fiches_techniques jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.gallery_items.prix_vente_ttc IS 'Prix vente TTC (TND) — affichage rapide pour clients / réseaux sociaux';
COMMENT ON COLUMN public.gallery_items.fiches_techniques IS 'Liste JSON d''URLs de fiches techniques (PDF, images)';
