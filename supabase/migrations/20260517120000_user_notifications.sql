-- Per-user in-app notifications (demandes d'achat, rappels véhicules, etc.)

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link_tab text,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
  ON public.user_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_dedup_idx
  ON public.user_notifications (user_id, type, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.user_notifications;
CREATE POLICY "Users read own notifications"
  ON public.user_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.user_notifications;
CREATE POLICY "Users update own notifications"
  ON public.user_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Annuaire (poste) pour cibler les destinataires — SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_notification_directory()
RETURNS TABLE(user_id uuid, full_name text, user_position text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text,
    coalesce(u.raw_user_meta_data->>'position', '')::text AS user_position
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_notification_directory() TO authenticated;

-- Utilisateurs avec accès section (ex. véhicules) + administrateurs
CREATE OR REPLACE FUNCTION public.get_user_ids_with_section_access(p_section_key text)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT uid), '{}'::uuid[])
  FROM (
    SELECT user_id AS uid
    FROM public.user_section_permissions
    WHERE section_key = p_section_key
      AND (subsection_key IS NULL OR subsection_key = '')
    UNION
    SELECT user_id AS uid
    FROM public.user_section_permissions
    WHERE section_key = p_section_key
      AND subsection_key <> ''
    UNION
    SELECT user_id AS uid
    FROM public.user_roles
    WHERE role = 'admin'::public.app_role
  ) s;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_ids_with_section_access(text) TO authenticated;

-- Création groupée (évite abus RLS insert croisé)
CREATE OR REPLACE FUNCTION public.dispatch_notifications(
  p_recipient_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link_tab text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_recipient_user_ids IS NULL OR array_length(p_recipient_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.user_notifications (
    user_id, type, title, body, link_tab, entity_type, entity_id, metadata, created_by
  )
  SELECT
    r.uid,
    p_type,
    p_title,
    p_body,
    p_link_tab,
    p_entity_type,
    p_entity_id,
    p_metadata,
    auth.uid()
  FROM unnest(p_recipient_user_ids) AS r(uid)
  WHERE r.uid IS NOT NULL
    AND r.uid <> auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_notifications un
      WHERE un.user_id = r.uid
        AND un.type = p_type
        AND un.entity_type IS NOT DISTINCT FROM p_entity_type
        AND un.entity_id IS NOT DISTINCT FROM p_entity_id
        AND un.entity_id IS NOT NULL
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_notifications(uuid[], text, text, text, text, text, text, jsonb) TO authenticated;

COMMENT ON TABLE public.user_notifications IS 'Notifications in-app par compte utilisateur';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;
