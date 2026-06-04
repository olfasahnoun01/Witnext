-- Attachments for demandes d'achat (documents.metadata), devis/BC, factures vente.

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_devis_ids JSONB;

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_bc_ids JSONB;

COMMENT ON COLUMN public.devis.attachment_urls IS 'Pièces jointes (PDF, images, etc.) — tableau {url, name, mime}.';
COMMENT ON COLUMN public.devis.source_devis_ids IS 'Devis sources fusionnés lors de la création d''un BC unique.';
COMMENT ON COLUMN public.factures.source_bc_ids IS 'BC vente fusionnés pour une facture unique.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('commercial-attachments', 'commercial-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS commercial_attachments_select ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS commercial_attachments_delete ON storage.objects;

CREATE POLICY commercial_attachments_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'commercial-attachments');

CREATE POLICY commercial_attachments_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'commercial-attachments');

CREATE POLICY commercial_attachments_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'commercial-attachments');
