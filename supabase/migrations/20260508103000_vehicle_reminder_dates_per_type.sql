ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS leasing_remind_at date,
  ADD COLUMN IF NOT EXISTS assurance_remind_at date,
  ADD COLUMN IF NOT EXISTS vignette_remind_at date,
  ADD COLUMN IF NOT EXISTS visite_technique_remind_at date;

