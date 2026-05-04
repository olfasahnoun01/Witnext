-- Fix PGRST204 for kilometrage_actuel when remote DB missed 20260501120000 migration
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS kilometrage_actuel NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.vehicles.kilometrage_actuel IS 'Odomètre actuel du véhicule (km), synchronisé avec les bons validés côté mobile.';

NOTIFY pgrst, 'reload schema';
