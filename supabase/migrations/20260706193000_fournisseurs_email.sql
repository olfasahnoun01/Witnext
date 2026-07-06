-- Email contact on fournisseurs (mirrors clients.email).
ALTER TABLE public.fournisseurs
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.fournisseurs.email IS
  'Adresse email du fournisseur (nommage documents, contact commercial).';

NOTIFY pgrst, 'reload schema';
