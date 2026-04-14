-- Migration: Add devis_helper_mappings table for Learning Mode
-- Created: 2026-04-14

CREATE TABLE IF NOT EXISTS public.devis_helper_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    extracted_name TEXT UNIQUE NOT NULL,
    fiche_technique_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.devis_helper_mappings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated read access" 
ON public.devis_helper_mappings FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated insert access" 
ON public.devis_helper_mappings FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated update access" 
ON public.devis_helper_mappings FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated delete access" 
ON public.devis_helper_mappings FOR DELETE 
TO authenticated 
USING (true);
