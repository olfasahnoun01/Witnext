
-- Create bons_commande table
CREATE TABLE public.bons_commande (
  id integer NOT NULL DEFAULT nextval(pg_catalog.pg_get_serial_sequence('devis', 'id')),
  bc_number text NOT NULL,
  bc_date date NOT NULL DEFAULT CURRENT_DATE,
  devis_id integer REFERENCES public.devis(id) ON DELETE SET NULL,
  type text NOT NULL,
  third_party_name text,
  third_party_address text,
  third_party_tax_id text,
  third_party_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'confirmé',
  is_ttc boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create a dedicated sequence
CREATE SEQUENCE IF NOT EXISTS bons_commande_id_seq;
ALTER TABLE public.bons_commande ALTER COLUMN id SET DEFAULT nextval('bons_commande_id_seq');
ALTER SEQUENCE bons_commande_id_seq OWNED BY public.bons_commande.id;

-- Primary key
ALTER TABLE public.bons_commande ADD PRIMARY KEY (id);

-- Enable RLS
ALTER TABLE public.bons_commande ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as devis)
CREATE POLICY "All authenticated users can read bons_commande"
  ON public.bons_commande FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert bons_commande"
  ON public.bons_commande FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins and moderators can update any bon_commande"
  ON public.bons_commande FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can update own bons_commande"
  ON public.bons_commande FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Admins and moderators can delete any bon_commande"
  ON public.bons_commande FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can delete own bons_commande"
  ON public.bons_commande FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_bons_commande_updated_at
  BEFORE UPDATE ON public.bons_commande
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
