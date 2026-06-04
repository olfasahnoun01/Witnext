-- Fuel vouchers: only admins may delete (moderators can no longer delete).
DROP POLICY IF EXISTS "fuel_vouchers_delete_staff" ON public.fuel_vouchers;

CREATE POLICY "fuel_vouchers_delete_admin"
  ON public.fuel_vouchers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
