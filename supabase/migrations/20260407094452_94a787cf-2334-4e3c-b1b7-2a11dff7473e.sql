
ALTER TABLE public.devis DROP CONSTRAINT devis_status_check;
ALTER TABLE public.devis ADD CONSTRAINT devis_status_check CHECK (status = ANY (ARRAY['brouillon'::text, 'envoyé'::text, 'accepté'::text, 'refusé'::text, 'confirmé'::text]));
