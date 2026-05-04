-- Fix PGRST204 / "constructeur ... schema cache" when remote DB missed earlier fleet migration
-- or PostgREST cache was stale after DDL.
--
-- If the error names table "vehicules" (French) and you have public.vehicules but not public.vehicles,
-- add the column on that table and align the name with the app, e.g.:
--   ALTER TABLE public.vehicules ADD COLUMN IF NOT EXISTS constructeur TEXT;
--   ALTER TABLE public.vehicules RENAME TO vehicles;
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS constructeur TEXT,
  ADD COLUMN IF NOT EXISTS type_carburant TEXT NOT NULL DEFAULT 'gasoil';

COMMENT ON COLUMN public.vehicles.constructeur IS 'Constructeur (ex. Renault, Toyota).';
COMMENT ON COLUMN public.vehicles.type_carburant IS 'gasoil | essence (autres valeurs possibles si besoin).';

NOTIFY pgrst, 'reload schema';
