-- Presence: RLS so users can upsert their row and staff can read all rows (required for
-- postgres_changes + Supabase Realtime). Publication so clients receive live updates.

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_presence_insert_own" ON public.user_presence;
DROP POLICY IF EXISTS "user_presence_update_own" ON public.user_presence;
DROP POLICY IF EXISTS "user_presence_select_own" ON public.user_presence;
DROP POLICY IF EXISTS "user_presence_staff_select_all" ON public.user_presence;

CREATE POLICY "user_presence_insert_own"
  ON public.user_presence FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_presence_update_own"
  ON public.user_presence FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_presence_select_own"
  ON public.user_presence FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_presence_staff_select_all"
  ON public.user_presence FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
END $$;
