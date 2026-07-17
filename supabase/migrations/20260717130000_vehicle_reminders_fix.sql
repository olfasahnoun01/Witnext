-- Fix vehicle_reminders: allow vidange type + company-member insert/update (align with vehicles).

ALTER TABLE public.vehicle_reminders
  DROP CONSTRAINT IF EXISTS vehicle_reminders_reminder_type_check;

ALTER TABLE public.vehicle_reminders
  ADD CONSTRAINT vehicle_reminders_reminder_type_check
  CHECK (reminder_type IN ('vignette', 'assurance', 'leasing', 'visite_technique', 'vidange'));

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.vehicle_reminders') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicle_reminders' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vehicle_reminders', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.vehicle_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_reminders_mc_select ON public.vehicle_reminders FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.user_company_ids()));

CREATE POLICY vehicle_reminders_mc_insert ON public.vehicle_reminders FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));

CREATE POLICY vehicle_reminders_mc_update ON public.vehicle_reminders FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.user_company_ids()))
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));

CREATE POLICY vehicle_reminders_mc_delete ON public.vehicle_reminders FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.user_company_ids())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  );
