-- Create fournisseurs table
CREATE TABLE public.fournisseurs (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  matricule_fiscale TEXT,
  specialite TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow public read on fournisseurs" 
ON public.fournisseurs 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on fournisseurs" 
ON public.fournisseurs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on fournisseurs" 
ON public.fournisseurs 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on fournisseurs" 
ON public.fournisseurs 
FOR DELETE 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_fournisseurs_updated_at
BEFORE UPDATE ON public.fournisseurs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();