-- Track who last modified commercial documents (devis / BC / BA / unified documents).

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_row_updated_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_devis_updated_by ON public.devis;
CREATE TRIGGER set_devis_updated_by
  BEFORE UPDATE ON public.devis
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_by();

DROP TRIGGER IF EXISTS set_documents_updated_by ON public.documents;
CREATE TRIGGER set_documents_updated_by
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_by();
