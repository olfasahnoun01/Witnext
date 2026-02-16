
-- Create devis table for quotes management (no stock impact)
CREATE TABLE public.devis (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('entrant', 'sortant')),
  devis_number TEXT NOT NULL,
  devis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  third_party_name TEXT,
  third_party_address TEXT,
  third_party_tax_id TEXT,
  third_party_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'envoyé', 'accepté', 'refusé')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as documents)
CREATE POLICY "Users can read own devis" ON public.devis
  FOR SELECT USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create devis" ON public.devis
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own devis" ON public.devis
  FOR UPDATE USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and moderators can update devis" ON public.devis
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can delete devis" ON public.devis
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_devis_updated_at
  BEFORE UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
