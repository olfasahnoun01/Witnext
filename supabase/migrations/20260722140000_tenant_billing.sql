-- =============================================================================
-- Tenant SaaS billing: license period + downloadable receipts
-- =============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS license_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_cycle text
    CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual'));

CREATE TABLE IF NOT EXISTS public.tenant_billing_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero text NOT NULL,
  plan text NOT NULL
    CHECK (plan IN ('trial', 'starter', 'pro', 'enterprise')),
  billing_cycle text
    CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual')),
  amount_ht numeric(14, 3) NOT NULL DEFAULT 0 CHECK (amount_ht >= 0),
  currency text NOT NULL DEFAULT 'TND',
  period_start timestamptz,
  period_end timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, numero)
);

CREATE INDEX IF NOT EXISTS tenant_billing_receipts_tenant_id_idx
  ON public.tenant_billing_receipts(tenant_id, issued_at DESC);

ALTER TABLE public.tenant_billing_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_billing_receipts_member_select ON public.tenant_billing_receipts;
CREATE POLICY tenant_billing_receipts_member_select ON public.tenant_billing_receipts
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
    OR public.is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- get_my_tenant: include license fields
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_tenant();

CREATE OR REPLACE FUNCTION public.get_my_tenant()
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  slug text,
  plan text,
  status text,
  trial_ends_at timestamptz,
  license_starts_at timestamptz,
  license_ends_at timestamptz,
  billing_cycle text,
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
    t.license_starts_at,
    t.license_ends_at,
    t.billing_cycle,
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
-- platform_list_tenants: include license fields
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.platform_list_tenants();

CREATE OR REPLACE FUNCTION public.platform_list_tenants()
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  slug text,
  plan text,
  status text,
  trial_ends_at timestamptz,
  license_starts_at timestamptz,
  license_ends_at timestamptz,
  billing_cycle text,
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
    t.license_starts_at,
    t.license_ends_at,
    t.billing_cycle,
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

-- ---------------------------------------------------------------------------
-- Grant / renew paid license + issue a receipt (platform admins only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_grant_tenant_license(
  p_tenant_id uuid,
  p_plan text,
  p_billing_cycle text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_amount_ht numeric DEFAULT 0,
  p_max_users integer DEFAULT NULL,
  p_max_companies integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_cycle text;
  v_numero text;
  v_year integer;
  v_count integer;
  v_receipt_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  v_plan := trim(coalesce(p_plan, ''));
  IF v_plan NOT IN ('starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  v_cycle := nullif(trim(coalesce(p_billing_cycle, '')), '');
  IF v_cycle IS NOT NULL AND v_cycle NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'invalid_billing_cycle';
  END IF;

  IF p_period_start IS NULL OR p_period_end IS NULL THEN
    RAISE EXCEPTION 'period_required';
  END IF;

  IF p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'invalid_period';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id) THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;

  UPDATE public.tenants
  SET
    plan = v_plan,
    status = 'active',
    trial_ends_at = NULL,
    billing_cycle = v_cycle,
    license_starts_at = p_period_start,
    license_ends_at = p_period_end,
    max_users = COALESCE(p_max_users, max_users),
    max_companies = COALESCE(p_max_companies, max_companies),
    updated_at = now()
  WHERE id = p_tenant_id;

  v_year := EXTRACT(YEAR FROM now())::integer;
  SELECT count(*)::integer INTO v_count
  FROM public.tenant_billing_receipts r
  WHERE r.tenant_id = p_tenant_id
    AND r.numero LIKE 'WR-' || v_year::text || '-%';

  v_numero := 'WR-' || v_year::text || '-' || lpad((v_count + 1)::text, 4, '0');

  INSERT INTO public.tenant_billing_receipts (
    tenant_id,
    numero,
    plan,
    billing_cycle,
    amount_ht,
    currency,
    period_start,
    period_end,
    notes,
    created_by
  ) VALUES (
    p_tenant_id,
    v_numero,
    v_plan,
    v_cycle,
    COALESCE(p_amount_ht, 0),
    'TND',
    p_period_start,
    p_period_end,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_receipt_id;

  RETURN jsonb_build_object(
    'receipt_id', v_receipt_id,
    'numero', v_numero,
    'tenant_id', p_tenant_id,
    'plan', v_plan,
    'period_end', p_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_grant_tenant_license(
  uuid, text, text, timestamptz, timestamptz, numeric, integer, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_grant_tenant_license(
  uuid, text, text, timestamptz, timestamptz, numeric, integer, integer, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
