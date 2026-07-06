-- Mobile driver app: allow chauffeurs to submit RH reports (rh_security_reports)
-- and upload attachments without ERP RH section permission.

DROP POLICY IF EXISTS rh_security_reports_driver_insert ON public.rh_security_reports;
CREATE POLICY rh_security_reports_driver_insert ON public.rh_security_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND company_id IN (
      SELECT e.company_id
      FROM public.employees e
      WHERE e.id IN (SELECT public.current_employee_ids())
        AND e.company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS rh_security_reports_driver_update ON public.rh_security_reports;
CREATE POLICY rh_security_reports_driver_update ON public.rh_security_reports
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND company_id IN (
      SELECT e.company_id
      FROM public.employees e
      WHERE e.id IN (SELECT public.current_employee_ids())
        AND e.company_id IS NOT NULL
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND company_id IN (
      SELECT e.company_id
      FROM public.employees e
      WHERE e.id IN (SELECT public.current_employee_ids())
        AND e.company_id IS NOT NULL
    )
  );

-- Storage: drivers can upload/read their own report attachments
DROP POLICY IF EXISTS rh_report_files_driver_insert ON storage.objects;
CREATE POLICY rh_report_files_driver_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rh-report-files'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id IN (SELECT public.current_employee_ids())
    )
  );

DROP POLICY IF EXISTS rh_report_files_driver_select ON storage.objects;
CREATE POLICY rh_report_files_driver_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rh-report-files'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id IN (SELECT public.current_employee_ids())
    )
  );
