CREATE TABLE IF NOT EXISTS public.factures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero VARCHAR NOT NULL UNIQUE,
    type VARCHAR NOT NULL DEFAULT 'vente', -- 'vente' or 'achat'
    date_creation DATE NOT NULL DEFAULT CURRENT_DATE,
    date_echeance DATE,
    third_party_name VARCHAR,
    third_party_address VARCHAR,
    third_party_tax_id VARCHAR,
    third_party_phone VARCHAR,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(10,3) NOT NULL DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'brouillon', -- 'brouillon', 'envoyée', 'payée', 'retard', 'annulée'
    is_ttc BOOLEAN DEFAULT true,
    source_bc_id BIGINT REFERENCES public.devis(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up triggers for updated_at
DROP TRIGGER IF EXISTS handle_factures_updated_at ON public.factures;
CREATE TRIGGER handle_factures_updated_at BEFORE UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

-- Policies for RLS
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all authenticated users" ON public.factures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.factures FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON public.factures FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.factures FOR DELETE TO authenticated USING (true);
