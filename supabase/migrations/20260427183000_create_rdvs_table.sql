-- Create rdvs table
CREATE TABLE IF NOT EXISTS public.rdvs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero TEXT NOT NULL,
    date_creation DATE DEFAULT CURRENT_DATE,
    societe TEXT NOT NULL,
    activite TEXT,
    adresse TEXT,
    telephone TEXT,
    email TEXT,
    personne_contactee TEXT,
    date_rdv TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    besoin TEXT,
    piece_jointe TEXT DEFAULT 'non envoyé',
    charge TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.rdvs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.rdvs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.rdvs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.rdvs
    FOR UPDATE USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER on_rdvs_updated
    BEFORE UPDATE ON public.rdvs
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
