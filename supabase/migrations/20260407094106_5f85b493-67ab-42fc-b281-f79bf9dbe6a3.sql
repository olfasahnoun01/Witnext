
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS is_bc boolean NOT NULL DEFAULT false;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS source_devis_id integer REFERENCES public.devis(id) ON DELETE SET NULL;
