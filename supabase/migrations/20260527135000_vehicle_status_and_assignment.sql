-- Vehicle operational status + driver assignment

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'disponible'
    CHECK (statut IN ('disponible', 'en_fonction', 'en_panne')),
  ADD COLUMN IF NOT EXISTS conducteur_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

