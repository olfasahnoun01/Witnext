-- Critical + high security fixes (team chat RLS, storage, profiles/roles, notifications, fuel vouchers).

-- ---------------------------------------------------------------------------
-- C1: team_chat_messages — RLS + identity enforcement on insert
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_chat_messages_select ON public.team_chat_messages;
DROP POLICY IF EXISTS team_chat_messages_insert ON public.team_chat_messages;
DROP POLICY IF EXISTS team_chat_messages_delete ON public.team_chat_messages;

CREATE POLICY team_chat_messages_select ON public.team_chat_messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY team_chat_messages_insert ON public.team_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND char_length(trim(content)) > 0
    AND char_length(content) <= 2000
  );

CREATE POLICY team_chat_messages_delete ON public.team_chat_messages
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.team_chat_messages_enforce_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_role text := 'user';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  NEW.user_id := auth.uid();

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid();
  NEW.user_email := coalesce(nullif(trim(v_email), ''), 'Utilisateur');

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    v_role := 'admin';
  ELSIF public.has_role(auth.uid(), 'moderator'::public.app_role) THEN
    v_role := 'moderator';
  END IF;
  NEW.user_role := v_role;

  NEW.content := left(trim(NEW.content), 2000);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_chat_messages_enforce_identity ON public.team_chat_messages;
CREATE TRIGGER team_chat_messages_enforce_identity
  BEFORE INSERT ON public.team_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.team_chat_messages_enforce_identity();

-- ---------------------------------------------------------------------------
-- C2: commercial-attachments storage — section-scoped (ventes / achats)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS commercial_attachments_select ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_delete ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_update ON storage.objects;

CREATE POLICY commercial_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'commercial-attachments'
    AND (
      public.user_has_app_section('ventes')
      OR public.user_has_app_section('achats')
    )
  );

CREATE POLICY commercial_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-attachments'
    AND (
      public.user_has_app_section('ventes')
      OR public.user_has_app_section('achats')
    )
  );

CREATE POLICY commercial_attachments_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'commercial-attachments'
    AND (
      public.user_has_app_section('ventes')
      OR public.user_has_app_section('achats')
    )
  );

CREATE POLICY commercial_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'commercial-attachments'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      OR public.user_has_app_section('ventes')
      OR public.user_has_app_section('achats')
    )
  );

-- ---------------------------------------------------------------------------
-- H1: profiles — company-scoped read; self update; staff full access
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_staff ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_companies uc_self
      JOIN public.user_companies uc_target ON uc_target.company_id = uc_self.company_id
      WHERE uc_self.user_id = auth.uid()
        AND uc_target.user_id = profiles.user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_section_permissions usp_self
      JOIN public.user_section_permissions usp_other
        ON usp_other.section_key = usp_self.section_key
      WHERE usp_self.user_id = auth.uid()
        AND usp_other.user_id = profiles.user_id
    )
  );

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update_staff ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- ---------------------------------------------------------------------------
-- H1: user_roles — own role or staff only
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select ON public.user_roles;

CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

-- No INSERT/UPDATE/DELETE policies for authenticated — mutations via service role only.

-- ---------------------------------------------------------------------------
-- H3: Notifications — tighten directory + validate dispatch recipients
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_notification_directory()
RETURNS TABLE(user_id uuid, full_name text, user_position text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'moderator'::public.app_role) THEN
    RETURN QUERY
    SELECT
      u.id,
      coalesce(p.full_name, u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text,
      coalesce(u.raw_user_meta_data->>'position', '')::text AS user_position
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id;
    RETURN;
  END IF;

  -- Section users: only colleagues in shared companies or with overlapping section access.
  RETURN QUERY
  SELECT DISTINCT
    u.id,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text,
    coalesce(u.raw_user_meta_data->>'position', '')::text AS user_position
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = auth.uid()
     OR EXISTS (
       SELECT 1
       FROM public.user_companies uc_self
       JOIN public.user_companies uc_other ON uc_other.company_id = uc_self.company_id
       WHERE uc_self.user_id = auth.uid()
         AND uc_other.user_id = u.id
     )
     OR EXISTS (
       SELECT 1
       FROM public.user_section_permissions usp_self
       JOIN public.user_section_permissions usp_other
         ON usp_other.section_key = usp_self.section_key
       WHERE usp_self.user_id = auth.uid()
         AND usp_other.user_id = u.id
     );
END;
$$;

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
  v_is_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_is_staff :=
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_section_permissions usp WHERE usp.user_id = auth.uid()
    );

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'not allowed to dispatch notifications';
  END IF;

  IF p_recipient_user_ids IS NULL OR array_length(p_recipient_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(p_recipient_user_ids) AS r(uid)
      WHERE r.uid IS NOT NULL
        AND r.uid <> auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_companies uc_self
          JOIN public.user_companies uc_target ON uc_target.company_id = uc_self.company_id
          WHERE uc_self.user_id = auth.uid()
            AND uc_target.user_id = r.uid
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_section_permissions usp_self
          JOIN public.user_section_permissions usp_target
            ON usp_target.section_key = usp_self.section_key
          WHERE usp_self.user_id = auth.uid()
            AND usp_target.user_id = r.uid
        )
    ) THEN
      RAISE EXCEPTION 'invalid notification recipients';
    END IF;
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

-- ---------------------------------------------------------------------------
-- H4: fuel_vouchers — INSERT restricted to staff or assigned driver
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS fuel_vouchers_mc_insert ON public.fuel_vouchers;

CREATE POLICY fuel_vouchers_mc_insert ON public.fuel_vouchers
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      OR conducteur_id IN (SELECT public.current_employee_ids())
    )
  );
