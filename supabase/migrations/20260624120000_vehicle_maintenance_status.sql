-- Allow dedicated maintenance operational status on fleet vehicles.

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_statut_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_statut_check
  CHECK (statut IN ('disponible', 'en_fonction', 'en_panne', 'en_maintenance'));
