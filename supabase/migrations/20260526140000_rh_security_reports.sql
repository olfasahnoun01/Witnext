-- RH security / site control reports (Rapports + Statistiques)
-- Note: renamed from 20260526120000 — that version was already used by fuel_vouchers_replica_identity.

CREATE TABLE IF NOT EXISTS public.rh_security_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_types text[] NOT NULL DEFAULT '{}',
  report_kind text NOT NULL DEFAULT 'controle_site',
  title text NOT NULL,
  subtitle text,
  company_name text,
  incident_date date,
  location text,
  incident_type_detail text,
  body_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  vehicle_info jsonb,
  attachment_paths text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS rh_security_reports_created_at_idx
  ON public.rh_security_reports (created_at DESC);

ALTER TABLE public.rh_security_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_security_reports_select ON public.rh_security_reports;
DROP POLICY IF EXISTS rh_security_reports_insert ON public.rh_security_reports;
DROP POLICY IF EXISTS rh_security_reports_update ON public.rh_security_reports;
DROP POLICY IF EXISTS rh_security_reports_delete ON public.rh_security_reports;

CREATE POLICY rh_security_reports_select
  ON public.rh_security_reports FOR SELECT TO authenticated
  USING (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY rh_security_reports_insert
  ON public.rh_security_reports FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY rh_security_reports_update
  ON public.rh_security_reports FOR UPDATE TO authenticated
  USING (
    public.user_has_app_section('rh')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE POLICY rh_security_reports_delete
  ON public.rh_security_reports FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('rh-report-files', 'rh-report-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS rh_report_files_select ON storage.objects;
DROP POLICY IF EXISTS rh_report_files_insert ON storage.objects;
DROP POLICY IF EXISTS rh_report_files_delete ON storage.objects;

CREATE POLICY rh_report_files_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rh-report-files'
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY rh_report_files_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rh-report-files'
    AND (
      public.user_has_app_section('rh')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );

CREATE POLICY rh_report_files_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'rh-report-files'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    )
  );
