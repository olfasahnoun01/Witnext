-- Vehicle registry: enrich vehicles table + reminders for notification center

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS leasing_company text,
  ADD COLUMN IF NOT EXISTS leasing_contract_number text,
  ADD COLUMN IF NOT EXISTS company_owner text,
  ADD COLUMN IF NOT EXISTS mise_en_circulation date,
  ADD COLUMN IF NOT EXISTS loyer_amount numeric,
  ADD COLUMN IF NOT EXISTS leasing_due_date date,
  ADD COLUMN IF NOT EXISTS assureur text,
  ADD COLUMN IF NOT EXISTS assurance_due_date date,
  ADD COLUMN IF NOT EXISTS vignette_due_date date,
  ADD COLUMN IF NOT EXISTS visite_technique_end_date date,
  ADD COLUMN IF NOT EXISTS contract_holder_name text,
  ADD COLUMN IF NOT EXISTS contract_document_url text;

CREATE TABLE IF NOT EXISTS public.vehicle_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('vignette', 'assurance', 'leasing', 'visite_technique')),
  due_date date NOT NULL,
  remind_at date NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, reminder_type, due_date)
);

DROP TRIGGER IF EXISTS update_vehicle_reminders_updated_at ON public.vehicle_reminders;
CREATE TRIGGER update_vehicle_reminders_updated_at
  BEFORE UPDATE ON public.vehicle_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vehicle_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth select vehicle reminders" ON public.vehicle_reminders;
DROP POLICY IF EXISTS "Auth insert vehicle reminders" ON public.vehicle_reminders;
DROP POLICY IF EXISTS "Auth update vehicle reminders" ON public.vehicle_reminders;
DROP POLICY IF EXISTS "Auth delete vehicle reminders" ON public.vehicle_reminders;

CREATE POLICY "Auth select vehicle reminders"
  ON public.vehicle_reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vehicle reminders"
  ON public.vehicle_reminders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update vehicle reminders"
  ON public.vehicle_reminders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete vehicle reminders"
  ON public.vehicle_reminders FOR DELETE TO authenticated USING (true);

