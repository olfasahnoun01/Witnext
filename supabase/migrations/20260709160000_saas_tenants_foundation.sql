-- =============================================================================
-- SaaS tenants foundation (Phase A)
-- Tenant = billing/subscription owner; companies remain operational legal entities.
-- =============================================================================

-- Allow dynamic company codes for new customers (keep legacy grosafe/granisafe/safe_team).
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_code_chk;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_code_format_chk CHECK (code ~ '^[a-z0-9_]{2,64}$');

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'starter', 'pro', 'enterprise')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'cancelled')),
  trial_ends_at timestamptz,
  max_companies integer NOT NULL DEFAULT 1 CHECK (max_companies >= 1),
  max_users integer NOT NULL DEFAULT 3 CHECK (max_users >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_members_user_id_idx ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS companies_tenant_id_idx ON public.companies(tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Backfill: legacy Grosafe / Granisafe / Safe-Team → one internal tenant
-- ---------------------------------------------------------------------------
INSERT INTO public.tenants (name, slug, plan, status, trial_ends_at, max_companies, max_users)
VALUES ('Grosafe Group', 'grosafe_group', 'enterprise', 'active', NULL, 10, 999)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.companies c
SET tenant_id = t.id
FROM public.tenants t
WHERE t.slug = 'grosafe_group'
  AND c.code IN ('grosafe', 'granisafe', 'safe_team')
  AND c.tenant_id IS NULL;

INSERT INTO public.tenant_members (tenant_id, user_id, role)
SELECT DISTINCT
  t.id,
  uc.user_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = uc.user_id AND ur.role = 'admin'::public.app_role
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = uc.user_id AND ur.role = 'moderator'::public.app_role
    ) THEN 'admin'
    ELSE 'member'
  END
FROM public.user_companies uc
INNER JOIN public.companies c ON c.id = uc.company_id
INNER JOIN public.tenants t ON t.slug = 'grosafe_group'
WHERE c.tenant_id = t.id
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.slugify_tenant_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '_' FROM regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '_', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_tenant_slug(p_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base text;
  v_slug text;
  v_suffix integer := 0;
BEGIN
  v_base := public.slugify_tenant_name(p_name);
  IF v_base = '' OR length(v_base) < 2 THEN
    v_base := 'tenant';
  END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.tenants t WHERE t.slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base || '_' || v_suffix::text;
  END LOOP;
  RETURN v_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_company_code(p_base text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base text;
  v_code text;
  v_suffix integer := 0;
BEGIN
  v_base := public.slugify_tenant_name(p_base);
  IF v_base = '' OR length(v_base) < 2 THEN
    v_base := 'company';
  END IF;
  v_code := v_base;
  WHILE EXISTS (SELECT 1 FROM public.companies c WHERE c.code = v_code) LOOP
    v_suffix := v_suffix + 1;
    v_code := v_base || '_' || v_suffix::text;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ---------------------------------------------------------------------------
-- Provision first tenant + company for the authenticated signup user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_my_tenant(
  p_company_name text,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_company_id uuid;
  v_slug text;
  v_code text;
  v_name text;
  v_existing record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_name := trim(coalesce(p_company_name, ''));
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'company_name_required';
  END IF;

  SELECT t.id AS tenant_id, c.id AS company_id, t.slug
  INTO v_existing
  FROM public.tenant_members tm
  INNER JOIN public.tenants t ON t.id = tm.tenant_id
  LEFT JOIN public.companies c ON c.tenant_id = t.id
  WHERE tm.user_id = v_user_id
  ORDER BY c.created_at NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'tenant_id', v_existing.tenant_id,
      'company_id', v_existing.company_id,
      'slug', v_existing.slug,
      'already_provisioned', true
    );
  END IF;

  v_slug := public.generate_unique_tenant_slug(v_name);
  v_code := public.generate_unique_company_code(v_slug);

  INSERT INTO public.tenants (
    name, slug, plan, status, trial_ends_at, max_companies, max_users
  )
  VALUES (
    v_name, v_slug, 'trial', 'active', now() + interval '14 days', 1, 3
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.companies (code, name, tenant_id)
  VALUES (v_code, v_name, v_tenant_id)
  RETURNING id INTO v_company_id;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'owner');

  INSERT INTO public.user_companies (user_id, company_id)
  VALUES (v_user_id, v_company_id)
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user_id AND ur.role = 'admin'::public.app_role
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin'::public.app_role);
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
    updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'company_id', v_company_id,
    'slug', v_slug,
    'already_provisioned', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_my_tenant(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_my_tenant(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_tenant()
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  slug text,
  plan text,
  status text,
  trial_ends_at timestamptz,
  max_companies integer,
  max_users integer,
  member_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.slug,
    t.plan,
    t.status,
    t.trial_ends_at,
    t.max_companies,
    t.max_users,
    tm.role
  FROM public.tenant_members tm
  INNER JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = auth.uid()
  ORDER BY t.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_tenant() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_member_select ON public.tenants;
CREATE POLICY tenants_member_select ON public.tenants
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tenants_owner_update ON public.tenants;
CREATE POLICY tenants_owner_update ON public.tenants
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS tenant_members_select ON public.tenant_members;
CREATE POLICY tenant_members_select ON public.tenant_members
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
