-- Patente and RNE (registre) document URLs for fournisseurs, aligned with clients.
ALTER TABLE public.fournisseurs
  ADD COLUMN IF NOT EXISTS patente_url text,
  ADD COLUMN IF NOT EXISTS registre_commerce_url text;
