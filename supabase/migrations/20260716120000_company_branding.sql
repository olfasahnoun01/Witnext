-- Company branding for invoice PDFs (logo, legal identity, theme colors).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS tel_fax text,
  ADD COLUMN IF NOT EXISTS rib text,
  ADD COLUMN IF NOT EXISTS code_tva text,
  ADD COLUMN IF NOT EXISTS brand_primary_color text NOT NULL DEFAULT '#1e2124',
  ADD COLUMN IF NOT EXISTS brand_header_color text NOT NULL DEFAULT '#e6e6e6',
  ADD COLUMN IF NOT EXISTS brand_table_color text NOT NULL DEFAULT '#ebebeb';

COMMENT ON COLUMN public.companies.logo_url IS 'Public URL of company logo for invoices and UI.';
COMMENT ON COLUMN public.companies.legal_name IS 'Legal name printed on invoices (defaults to name if empty).';
COMMENT ON COLUMN public.companies.brand_primary_color IS 'Hex accent color for invoice PDF branding.';

-- Admins may update branding for companies they belong to.
DROP POLICY IF EXISTS companies_update_branding ON public.companies;
CREATE POLICY companies_update_branding ON public.companies
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  )
  WITH CHECK (
    id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

-- Public bucket: logos must be loadable in browser PDF generation (Image crossOrigin).
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS company_assets_select ON storage.objects;
DROP POLICY IF EXISTS company_assets_insert ON storage.objects;
DROP POLICY IF EXISTS company_assets_update ON storage.objects;
DROP POLICY IF EXISTS company_assets_delete ON storage.objects;

CREATE POLICY company_assets_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-assets');

CREATE POLICY company_assets_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text
      FROM public.user_companies uc
      WHERE uc.user_id = auth.uid()
    )
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY company_assets_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text
      FROM public.user_companies uc
      WHERE uc.user_id = auth.uid()
    )
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY company_assets_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text
      FROM public.user_companies uc
      WHERE uc.user_id = auth.uid()
    )
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

-- Allow anonymous/public read for logo URLs embedded in PDFs.
DROP POLICY IF EXISTS company_assets_public_select ON storage.objects;
CREATE POLICY company_assets_public_select ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'company-assets');
