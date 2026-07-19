-- Fleet maintenance + vehicle charges + planning saved names.
-- These tables were referenced by mc_* installers but never created in migrations
-- (mc_setup_company_column skipped them silently). App data lived in localStorage.

CREATE TABLE IF NOT EXISTS public.maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_label text NOT NULL DEFAULT '',
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('preventive', 'urgent', 'corrective')),
  date_debut date NOT NULL,
  cout_estime text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('en_cours', 'termine', 'annule')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_label text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('visite_technique', 'assurance', 'vignette', 'leasing')),
  date_echeance date NOT NULL,
  montant text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  provider text,
  contract_number text,
  reminder_date date,
  valeur_totale text,
  montant_paye text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planning_saved_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('company', 'site')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.mc_setup_company_column('maintenance');
SELECT public.mc_setup_company_column('vehicle_charges');
SELECT public.mc_setup_company_column('planning_saved_names');

SELECT public.mc_apply_company_section_rls('maintenance', ARRAY['vehicules']);
SELECT public.mc_apply_company_section_rls('vehicle_charges', ARRAY['vehicules']);
SELECT public.mc_apply_company_section_rls('planning_saved_names', ARRAY['planning', 'rh']);

CREATE UNIQUE INDEX IF NOT EXISTS planning_saved_names_company_kind_name_uidx
  ON public.planning_saved_names (company_id, kind, name);

DROP TRIGGER IF EXISTS update_maintenance_updated_at ON public.maintenance;
CREATE TRIGGER update_maintenance_updated_at
  BEFORE UPDATE ON public.maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicle_charges_updated_at ON public.vehicle_charges;
CREATE TRIGGER update_vehicle_charges_updated_at
  BEFORE UPDATE ON public.vehicle_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
