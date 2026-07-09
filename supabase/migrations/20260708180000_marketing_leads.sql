-- Marketing site: trial and licence inquiry leads (manual follow-up by admin team).

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('trial', 'license')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  team_size text,
  user_count integer,
  deployment text CHECK (deployment IS NULL OR deployment IN ('web', 'desktop', 'both')),
  plan_code text,
  modules text[] NOT NULL DEFAULT '{}',
  message text,
  source_path text,
  internal_notes text,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS marketing_leads_created_at_idx
  ON public.marketing_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_leads_email_created_idx
  ON public.marketing_leads (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_leads_status_idx
  ON public.marketing_leads (status);

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- No public INSERT: submissions go through submit-marketing-lead edge function (service role).

DROP POLICY IF EXISTS marketing_leads_admin_select ON public.marketing_leads;
CREATE POLICY marketing_leads_admin_select ON public.marketing_leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

DROP POLICY IF EXISTS marketing_leads_admin_update ON public.marketing_leads;
CREATE POLICY marketing_leads_admin_update ON public.marketing_leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

DROP POLICY IF EXISTS marketing_leads_admin_delete ON public.marketing_leads;
CREATE POLICY marketing_leads_admin_delete ON public.marketing_leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.touch_marketing_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_leads_updated_at ON public.marketing_leads;
CREATE TRIGGER marketing_leads_updated_at
  BEFORE UPDATE ON public.marketing_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_marketing_leads_updated_at();
