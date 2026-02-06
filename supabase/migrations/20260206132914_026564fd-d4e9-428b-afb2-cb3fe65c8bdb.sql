-- Create a table to store multiple suppliers per product group with their prices
CREATE TABLE public.product_group_fournisseurs (
  id SERIAL PRIMARY KEY,
  product_group_id INTEGER NOT NULL REFERENCES public.product_groups(id) ON DELETE CASCADE,
  fournisseur_name TEXT NOT NULL,
  prix_ttc NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_group_id, fournisseur_name)
);

-- Enable RLS
ALTER TABLE public.product_group_fournisseurs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins and moderators can read product_group_fournisseurs"
ON public.product_group_fournisseurs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can read product_group_fournisseurs"
ON public.product_group_fournisseurs
FOR SELECT
USING (true);

CREATE POLICY "Admins and moderators can insert product_group_fournisseurs"
ON public.product_group_fournisseurs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can update product_group_fournisseurs"
ON public.product_group_fournisseurs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can delete product_group_fournisseurs"
ON public.product_group_fournisseurs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_product_group_fournisseurs_updated_at
BEFORE UPDATE ON public.product_group_fournisseurs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();