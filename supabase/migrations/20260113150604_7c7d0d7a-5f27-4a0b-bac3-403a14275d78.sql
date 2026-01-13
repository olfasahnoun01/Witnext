-- MIGRATION PRODUIT/VARIANTE - ÉTAPE 1: Création de la table product_groups
-- Cette migration préserve 100% des données existantes

-- Table des groupes de produits (Produit logique)
CREATE TABLE public.product_groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_sku TEXT, -- Code article de référence (premier SKU du groupe)
    fournisseur TEXT,
    image TEXT, -- Image représentative du groupe
    min_stock INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- Unicité par nom + catégorie
    UNIQUE(name, category)
);

-- Ajouter la colonne product_group_id à products (nullable pour migration progressive)
ALTER TABLE public.products 
ADD COLUMN product_group_id INTEGER REFERENCES public.product_groups(id) ON DELETE SET NULL;

-- Index pour performance
CREATE INDEX idx_products_group_id ON public.products(product_group_id);
CREATE INDEX idx_product_groups_category ON public.product_groups(category);
CREATE INDEX idx_product_groups_name ON public.product_groups(name);

-- Enable RLS on product_groups
ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour product_groups (mêmes que products)
CREATE POLICY "Admins and moderators can read product_groups" 
ON public.product_groups 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can insert product_groups" 
ON public.product_groups 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can update product_groups" 
ON public.product_groups 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins can delete product_groups" 
ON public.product_groups 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger pour updated_at
CREATE TRIGGER update_product_groups_updated_at
BEFORE UPDATE ON public.product_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- MIGRATION DES DONNÉES: Créer les groupes à partir des produits existants
INSERT INTO public.product_groups (name, category, base_sku, fournisseur, image, min_stock)
SELECT DISTINCT ON (name, category)
    name,
    category,
    sku as base_sku,
    fournisseur,
    image,
    min_stock
FROM public.products
ORDER BY name, category, id;

-- Lier chaque produit à son groupe
UPDATE public.products p
SET product_group_id = pg.id
FROM public.product_groups pg
WHERE p.name = pg.name AND p.category = pg.category;