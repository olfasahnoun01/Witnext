-- Administration module: admin role only (not moderator, not permission rows).

DROP POLICY IF EXISTS user_section_permissions_select ON public.user_section_permissions;

CREATE POLICY user_section_permissions_select ON public.user_section_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Strip legacy administration grants (ineffective for UI; avoids confusion in audits).
DELETE FROM public.user_section_permissions
WHERE section_key = 'administration';
