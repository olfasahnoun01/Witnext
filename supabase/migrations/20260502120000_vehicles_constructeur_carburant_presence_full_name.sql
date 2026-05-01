-- Fleet: marque / carburant
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS constructeur TEXT,
  ADD COLUMN IF NOT EXISTS type_carburant TEXT NOT NULL DEFAULT 'gasoil';

COMMENT ON COLUMN public.vehicles.constructeur IS 'Constructeur (ex. Renault, Toyota).';
COMMENT ON COLUMN public.vehicles.type_carburant IS 'gasoil | essence (autres valeurs possibles si besoin).';

-- Presence: afficher le nom complet plutôt que l''email seul
ALTER TABLE public.user_presence
  ADD COLUMN IF NOT EXISTS full_name TEXT;

COMMENT ON COLUMN public.user_presence.full_name IS 'Nom affiché (souvent aligné sur profiles.full_name ou user_metadata).';
