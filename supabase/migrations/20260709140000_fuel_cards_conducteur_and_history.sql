-- Fuel cards: link to driver + persist recharge/creation history in Postgres.
-- Depends on 20260709130000_create_fuel_cards_table.sql

ALTER TABLE public.fuel_cards
  ADD COLUMN IF NOT EXISTS conducteur_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.fuel_card_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.fuel_cards(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('creation', 'recharge')),
  amount numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fuel_card_history_card_id
  ON public.fuel_card_history(card_id, created_at DESC);

ALTER TABLE public.fuel_card_history ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.fuel_card_history') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fuel_card_history' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fuel_card_history', r.policyname);
  END LOOP;
END $$;

CREATE POLICY fuel_card_history_mc_select ON public.fuel_card_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fuel_cards fc
    WHERE fc.id = fuel_card_history.card_id
      AND fc.company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
  ));

CREATE POLICY fuel_card_history_mc_insert ON public.fuel_card_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fuel_cards fc
    WHERE fc.id = fuel_card_history.card_id
      AND fc.company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
  ));

CREATE POLICY fuel_card_history_mc_update ON public.fuel_card_history FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fuel_cards fc
    WHERE fc.id = fuel_card_history.card_id
      AND fc.company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fuel_cards fc
    WHERE fc.id = fuel_card_history.card_id
      AND fc.company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
  ));

CREATE POLICY fuel_card_history_mc_delete ON public.fuel_card_history FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fuel_cards fc
    WHERE fc.id = fuel_card_history.card_id
      AND fc.company_id IN (SELECT public.user_company_ids())
      AND public.user_has_any_app_section(ARRAY['vehicules']::text[])
  ));

NOTIFY pgrst, 'reload schema';
