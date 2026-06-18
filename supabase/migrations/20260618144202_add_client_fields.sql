-- Add new fields to the clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS nature_activite TEXT,
ADD COLUMN IF NOT EXISTS attestation_exoneration_url TEXT;
