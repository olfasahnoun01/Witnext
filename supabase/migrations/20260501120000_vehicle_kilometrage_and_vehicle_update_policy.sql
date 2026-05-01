-- Current odometer on fleet vehicles (used for fuel vouchers / mobile driver flow)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS kilometrage_actuel NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.vehicles.kilometrage_actuel IS 'Odomètre actuel du véhicule (km), synchronisé avec les bons validés côté mobile.';

-- Allow authenticated clients to update vehicles (odometer, corrections)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'Auth update vehicles'
  ) THEN
    CREATE POLICY "Auth update vehicles" ON public.vehicles
      FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
