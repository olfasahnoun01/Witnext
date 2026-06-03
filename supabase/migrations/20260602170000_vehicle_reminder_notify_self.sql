-- Allow users to receive their own vehicle reminder notifications (e.g. admin testing same day).

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
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_section_permissions usp WHERE usp.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'not allowed to dispatch notifications';
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
    AND (
      p_entity_type = 'vehicle_reminder'
      OR r.uid <> auth.uid()
    )
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
