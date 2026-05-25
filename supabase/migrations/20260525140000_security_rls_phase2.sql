-- Phase 2: tighten permissive RLS (factures, fleet, storage, presence, fuel vouchers).

-- ---------------------------------------------------------------------------
-- Helper: employee row(s) linked to the signed-in user (email match)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_employee_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.email IS NOT NULL
    AND lower(trim(e.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

REVOKE ALL ON FUNCTION public.current_employee_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_employee_ids() TO authenticated;

-- ---------------------------------------------------------------------------
-- Factures (commerce): read for staff; mutate admin/moderator only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.factures;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.factures;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.factures;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.factures;

CREATE POLICY "factures_select_authenticated"
  ON public.factures FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "factures_insert_staff"
  ON public.factures FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY "factures_update_staff"
  ON public.factures FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY "factures_delete_staff"
  ON public.factures FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- ---------------------------------------------------------------------------
-- Vehicle reminders: staff mutate; all authenticated read
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth select vehicle reminders" ON public.vehicle_reminders;
DROP POLICY IF EXISTS "Auth insert vehicle reminders" ON public.vehicle_reminders;
DROP POLICY IF EXISTS "Auth update vehicle reminders" ON public.vehicle_reminders;
DROP POLICY IF EXISTS "Auth delete vehicle reminders" ON public.vehicle_reminders;

CREATE POLICY "vehicle_reminders_select_authenticated"
  ON public.vehicle_reminders FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "vehicle_reminders_insert_staff"
  ON public.vehicle_reminders FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY "vehicle_reminders_update_staff"
  ON public.vehicle_reminders FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY "vehicle_reminders_delete_staff"
  ON public.vehicle_reminders FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- ---------------------------------------------------------------------------
-- Vehicles: staff full update; drivers bump odometer via RPC only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth update vehicles" ON public.vehicles;

CREATE POLICY "vehicles_update_staff"
  ON public.vehicles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.update_vehicle_kilometrage_actuel(
  p_vehicle_id uuid,
  p_km numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_km IS NULL OR p_km < 0 THEN
    RAISE EXCEPTION 'invalid kilometrage';
  END IF;
  UPDATE public.vehicles
  SET kilometrage_actuel = p_km,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_vehicle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_vehicle_kilometrage_actuel(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_vehicle_kilometrage_actuel(uuid, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- Fuel vouchers: staff manage; drivers update own rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "fuel_vouchers_select_authenticated" ON public.fuel_vouchers;
DROP POLICY IF EXISTS "fuel_vouchers_insert_staff" ON public.fuel_vouchers;
DROP POLICY IF EXISTS "fuel_vouchers_update_staff_or_driver" ON public.fuel_vouchers;
DROP POLICY IF EXISTS "fuel_vouchers_delete_staff" ON public.fuel_vouchers;

CREATE POLICY "fuel_vouchers_select_authenticated"
  ON public.fuel_vouchers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "fuel_vouchers_insert_authenticated"
  ON public.fuel_vouchers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "fuel_vouchers_update_staff_or_driver"
  ON public.fuel_vouchers FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR conducteur_id IN (SELECT public.current_employee_ids())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR conducteur_id IN (SELECT public.current_employee_ids())
  );

CREATE POLICY "fuel_vouchers_delete_staff"
  ON public.fuel_vouchers FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- ---------------------------------------------------------------------------
-- User presence: staff can see all online users (revert broad SELECT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_presence_select_authenticated_all" ON public.user_presence;

CREATE POLICY "user_presence_staff_select_all"
  ON public.user_presence FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- ---------------------------------------------------------------------------
-- Storage: authenticated read/upload; delete restricted to staff
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read fiches-techniques" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload fiches-techniques" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update fiches-techniques" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete fiches-techniques" ON storage.objects;

CREATE POLICY "fiches_techniques_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fiches-techniques');

CREATE POLICY "fiches_techniques_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fiches-techniques');

CREATE POLICY "fiches_techniques_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fiches-techniques');

CREATE POLICY "fiches_techniques_delete_staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fiches-techniques'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated can read client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete client-documents" ON storage.objects;

CREATE POLICY "client_documents_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents');

CREATE POLICY "client_documents_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "client_documents_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-documents');

CREATE POLICY "client_documents_delete_staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated can read product-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload product-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update product-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete product-documents" ON storage.objects;

CREATE POLICY "product_documents_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-documents');

CREATE POLICY "product_documents_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-documents');

CREATE POLICY "product_documents_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-documents');

CREATE POLICY "product_documents_delete_staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-documents'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
