-- Allow ERP RH / admin users to read chauffeur visit rapports (mobile → public.rapports).

DO $$
BEGIN
  IF to_regclass('public.rapports') IS NULL THEN
    RAISE NOTICE 'public.rapports missing — run mobile rapports setup first';
    RETURN;
  END IF;

  ALTER TABLE public.rapports ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS rapports_select_rh_staff ON public.rapports;
  CREATE POLICY rapports_select_rh_staff ON public.rapports
    FOR SELECT TO authenticated
    USING (
      public.user_has_any_app_section(ARRAY['rh']::text[])
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.user_id = auth.uid()
          AND lower(coalesce(e.role, '')) IN (
            'admin', 'administrateur', 'manager', 'superviseur',
            'supervisor', 'direction', 'rh', 'operateur', 'opérateur'
          )
      )
    );

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rapports;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
