-- Online users: only admins can read org-wide presence roster.
-- Section access: moderators no longer bypass user_has_app_section (UI + RLS aligned).

-- ---------------------------------------------------------------------------
-- user_presence SELECT — own row + admin roster
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_presence_select_company_peers ON public.user_presence;
DROP POLICY IF EXISTS "user_presence_staff_select_all" ON public.user_presence;
DROP POLICY IF EXISTS user_presence_staff_select_all ON public.user_presence;
DROP POLICY IF EXISTS "user_presence_select_own" ON public.user_presence;
DROP POLICY IF EXISTS user_presence_select_own ON public.user_presence;

CREATE POLICY user_presence_select ON public.user_presence
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ---------------------------------------------------------------------------
-- Section helpers — admin bypass only (not moderator)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_app_section(p_section_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_section_permissions usp
      WHERE usp.user_id = auth.uid()
        AND usp.section_key = p_section_key
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_app_section(p_section_keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_section_permissions usp
      WHERE usp.user_id = auth.uid()
        AND usp.section_key = ANY (p_section_keys)
    );
$$;
