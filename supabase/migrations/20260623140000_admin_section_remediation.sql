-- Administration section remediation:
--   * user_companies DELETE aligned with INSERT (admin only)
--   * moderators can read all user_section_permissions (read-only in UI)
--   * require_admin_role() for backup export/import RPC gate

-- ---------------------------------------------------------------------------
-- user_section_permissions: staff can read all rows (writes remain admin-only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own permissions" ON public.user_section_permissions;

CREATE POLICY user_section_permissions_select ON public.user_section_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- INSERT/UPDATE/DELETE policies unchanged (admin only from 20260419210104)

-- ---------------------------------------------------------------------------
-- user_companies: DELETE admin-only (match INSERT after phase 3)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_companies_delete_admin ON public.user_companies;

CREATE POLICY user_companies_delete_admin ON public.user_companies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Server gate for org backup export / restore (Settings.tsx + dbService)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_admin_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin required';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.require_admin_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_admin_role() TO authenticated;
