-- fuel_cards existed in schema.sql but was never created in migrations.
-- Earlier mc_* installers skipped it silently when the table was absent.

CREATE TABLE IF NOT EXISTS public.fuel_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  num_carte text NOT NULL,
  solde numeric NOT NULL DEFAULT 0,
  type text,
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.mc_setup_company_column('fuel_cards');
SELECT public.mc_make_company_unique('fuel_cards', 'num_carte');
SELECT public.mc_apply_company_section_rls('fuel_cards', ARRAY['vehicules']);

DROP TRIGGER IF EXISTS update_fuel_cards_updated_at ON public.fuel_cards;
CREATE TRIGGER update_fuel_cards_updated_at
  BEFORE UPDATE ON public.fuel_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
