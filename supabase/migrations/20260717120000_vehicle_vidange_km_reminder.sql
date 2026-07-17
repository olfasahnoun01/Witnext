-- Rappel vidange par kilométrage (intervalle personnalisé par véhicule).

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vidange_interval_km integer,
  ADD COLUMN IF NOT EXISTS vidange_last_km numeric;

COMMENT ON COLUMN public.vehicles.vidange_interval_km IS
  'Intervalle vidange en km (ex. 8000, 10000). NULL = rappel vidange désactivé.';
COMMENT ON COLUMN public.vehicles.vidange_last_km IS
  'Kilométrage enregistré au dernier vidange moteur.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_vidange_interval_km_chk'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_vidange_interval_km_chk
      CHECK (vidange_interval_km IS NULL OR vidange_interval_km > 0);
  END IF;
END $$;
