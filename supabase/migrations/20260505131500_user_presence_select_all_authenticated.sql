-- Presence visibility: allow every authenticated user to read online users list.
-- Keep insert/update restricted to own row.

DROP POLICY IF EXISTS "user_presence_select_own" ON public.user_presence;
DROP POLICY IF EXISTS "user_presence_staff_select_all" ON public.user_presence;
DROP POLICY IF EXISTS "user_presence_select_authenticated_all" ON public.user_presence;

CREATE POLICY "user_presence_select_authenticated_all"
  ON public.user_presence FOR SELECT TO authenticated
  USING (true);
