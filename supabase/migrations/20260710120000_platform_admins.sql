-- =============================================================================
-- Platform admins ("admin of admins")
-- Operator accounts that can provision tenants and oversee the SaaS.
-- Tenant admins remain scoped to their own tenant via tenant_members.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

COMMENT ON TABLE public.platform_admins IS
  'Witnext platform operators. Seed manually: INSERT INTO platform_admins (user_id) VALUES (''<auth.users.id>'');';

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admins_self_select ON public.platform_admins;
CREATE POLICY platform_admins_self_select ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for authenticated — service role / SQL only.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Platform can see all tenants; members still see only their own
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenants_member_select ON public.tenants;
CREATE POLICY tenants_member_select ON public.tenants
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tenant_members_select ON public.tenant_members;
CREATE POLICY tenant_members_select ON public.tenant_members
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Platform list / status helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_list_tenants()
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  slug text,
  plan text,
  status text,
  trial_ends_at timestamptz,
  max_companies integer,
  max_users integer,
  created_at timestamptz,
  company_count bigint,
  member_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.plan,
    t.status,
    t.trial_ends_at,
    t.max_companies,
    t.max_users,
    t.created_at,
    (SELECT count(*)::bigint FROM public.companies c WHERE c.tenant_id = t.id),
    (SELECT count(*)::bigint FROM public.tenant_members tm WHERE tm.tenant_id = t.id)
  FROM public.tenants t
  ORDER BY t.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_list_tenants() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_set_tenant_status(
  p_tenant_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE public.tenants
  SET status = p_status, updated_at = now()
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_set_tenant_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_status(uuid, text) TO authenticated;

-- Create tenant + first company only (owner account is created by manage-users edge fn).
CREATE OR REPLACE FUNCTION public.platform_create_tenant_shell(
  p_company_name text,
  p_plan text DEFAULT 'trial',
  p_max_companies integer DEFAULT 1,
  p_max_users integer DEFAULT 5,
  p_trial_days integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_slug text;
  v_code text;
  v_tenant_id uuid;
  v_company_id uuid;
  v_plan text;
  v_max_c integer;
  v_max_u integer;
  v_trial timestamptz;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  v_name := trim(coalesce(p_company_name, ''));
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'company_name_required';
  END IF;

  v_plan := coalesce(nullif(trim(p_plan), ''), 'trial');
  IF v_plan NOT IN ('trial', 'starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  v_max_c := greatest(coalesce(p_max_companies, 1), 1);
  v_max_u := greatest(coalesce(p_max_users, 5), 1);
  v_trial := CASE
    WHEN v_plan = 'trial' THEN now() + make_interval(days => greatest(coalesce(p_trial_days, 14), 1))
    ELSE NULL
  END;

  v_slug := public.generate_unique_tenant_slug(v_name);
  v_code := public.generate_unique_company_code(v_slug);

  INSERT INTO public.tenants (
    name, slug, plan, status, trial_ends_at, max_companies, max_users
  )
  VALUES (
    v_name, v_slug, v_plan, 'active', v_trial, v_max_c, v_max_u
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.companies (code, name, tenant_id)
  VALUES (v_code, v_name, v_tenant_id)
  RETURNING id INTO v_company_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'company_id', v_company_id,
    'slug', v_slug,
    'company_code', v_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_create_tenant_shell(text, text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_create_tenant_shell(text, text, integer, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
