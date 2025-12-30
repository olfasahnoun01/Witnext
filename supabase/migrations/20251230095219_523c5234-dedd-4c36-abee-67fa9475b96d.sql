-- Create documents table to store document history
CREATE TABLE public.documents (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bon_livraison', 'bon_sortie', 'bon_entree')),
  doc_number TEXT NOT NULL,
  doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validity TEXT,
  transport_ref TEXT,
  third_party_name TEXT,
  third_party_address TEXT,
  third_party_tax_id TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view documents
CREATE POLICY "Allow authenticated read on documents"
ON public.documents
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert documents
CREATE POLICY "Allow authenticated insert on documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only admins can update documents
CREATE POLICY "Admins can update documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete documents
CREATE POLICY "Admins can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();