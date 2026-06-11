-- Commercial flux dossiers: end-to-end client/supplier order tracking
CREATE TABLE IF NOT EXISTS public.commercial_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  dossier_number text NOT NULL,
  direction text NOT NULL DEFAULT 'vente' CHECK (direction IN ('vente', 'achat')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'completed', 'cancelled')),
  client_id bigint REFERENCES public.clients(id) ON DELETE SET NULL,
  fournisseur_id bigint REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  client_name text,
  fournisseur_name text,
  anchor_devis_id bigint REFERENCES public.devis(id) ON DELETE SET NULL,
  anchor_bc_devis_id bigint REFERENCES public.devis(id) ON DELETE SET NULL,
  anchor_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  bc_reference text,
  devis_reference text,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_role text CHECK (assigned_role IS NULL OR assigned_role IN ('commercial', 'achats', 'magasin', 'finance')),
  current_step text,
  health text NOT NULL DEFAULT 'in_progress' CHECK (health IN ('complete', 'in_progress', 'incomplete')),
  missing_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_percent int NOT NULL DEFAULT 0 CHECK (completion_percent >= 0 AND completion_percent <= 100),
  next_action_label text,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (company_id, dossier_number)
);

CREATE INDEX IF NOT EXISTS idx_commercial_dossiers_company ON public.commercial_dossiers(company_id);
CREATE INDEX IF NOT EXISTS idx_commercial_dossiers_health ON public.commercial_dossiers(company_id, health);
CREATE INDEX IF NOT EXISTS idx_commercial_dossiers_client_name ON public.commercial_dossiers(company_id, client_name);
CREATE INDEX IF NOT EXISTS idx_commercial_dossiers_fournisseur_name ON public.commercial_dossiers(company_id, fournisseur_name);
CREATE INDEX IF NOT EXISTS idx_commercial_dossiers_anchor_bc ON public.commercial_dossiers(anchor_bc_devis_id);

CREATE TABLE IF NOT EXISTS public.commercial_dossier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.commercial_dossiers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('step_change', 'note', 'assignment', 'action', 'notification')),
  step_key text,
  message text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_dossier_events_dossier ON public.commercial_dossier_events(dossier_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.commercial_dossier_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.commercial_dossiers(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('done', 'skipped')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  UNIQUE (dossier_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_commercial_dossier_checkpoints_dossier ON public.commercial_dossier_checkpoints(dossier_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.commercial_dossiers_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_dossiers_updated_at ON public.commercial_dossiers;
CREATE TRIGGER trg_commercial_dossiers_updated_at
  BEFORE UPDATE ON public.commercial_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.commercial_dossiers_set_updated_at();

-- RLS
ALTER TABLE public.commercial_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_dossier_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_dossier_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_dossiers_select ON public.commercial_dossiers;
CREATE POLICY commercial_dossiers_select ON public.commercial_dossiers
  FOR SELECT TO authenticated
  USING (public.user_in_company(company_id));

DROP POLICY IF EXISTS commercial_dossiers_insert ON public.commercial_dossiers;
CREATE POLICY commercial_dossiers_insert ON public.commercial_dossiers
  FOR INSERT TO authenticated
  WITH CHECK (public.user_in_company(company_id));

DROP POLICY IF EXISTS commercial_dossiers_update ON public.commercial_dossiers;
CREATE POLICY commercial_dossiers_update ON public.commercial_dossiers
  FOR UPDATE TO authenticated
  USING (public.user_in_company(company_id));

DROP POLICY IF EXISTS commercial_dossiers_delete ON public.commercial_dossiers;
CREATE POLICY commercial_dossiers_delete ON public.commercial_dossiers
  FOR DELETE TO authenticated
  USING (public.user_in_company(company_id));

DROP POLICY IF EXISTS commercial_dossier_events_select ON public.commercial_dossier_events;
CREATE POLICY commercial_dossier_events_select ON public.commercial_dossier_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commercial_dossiers d
      WHERE d.id = dossier_id AND public.user_in_company(d.company_id)
    )
  );

DROP POLICY IF EXISTS commercial_dossier_events_insert ON public.commercial_dossier_events;
CREATE POLICY commercial_dossier_events_insert ON public.commercial_dossier_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commercial_dossiers d
      WHERE d.id = dossier_id AND public.user_in_company(d.company_id)
    )
  );

DROP POLICY IF EXISTS commercial_dossier_checkpoints_select ON public.commercial_dossier_checkpoints;
CREATE POLICY commercial_dossier_checkpoints_select ON public.commercial_dossier_checkpoints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commercial_dossiers d
      WHERE d.id = dossier_id AND public.user_in_company(d.company_id)
    )
  );

DROP POLICY IF EXISTS commercial_dossier_checkpoints_insert ON public.commercial_dossier_checkpoints;
CREATE POLICY commercial_dossier_checkpoints_insert ON public.commercial_dossier_checkpoints
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commercial_dossiers d
      WHERE d.id = dossier_id AND public.user_in_company(d.company_id)
    )
  );

DROP POLICY IF EXISTS commercial_dossier_checkpoints_update ON public.commercial_dossier_checkpoints;
CREATE POLICY commercial_dossier_checkpoints_update ON public.commercial_dossier_checkpoints
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commercial_dossiers d
      WHERE d.id = dossier_id AND public.user_in_company(d.company_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_dossiers TO authenticated;
GRANT SELECT, INSERT ON public.commercial_dossier_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.commercial_dossier_checkpoints TO authenticated;
