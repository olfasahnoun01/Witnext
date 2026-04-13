-- Create products table
CREATE TABLE public.products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL,
  fournisseur TEXT,
  size TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10,3) NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity INTEGER NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for this inventory app)
CREATE POLICY "Allow public read on products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public insert on products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on products" ON public.products FOR DELETE USING (true);

CREATE POLICY "Allow public read on transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on transactions" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on transactions" ON public.transactions FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_fournisseur ON public.products(fournisseur);
CREATE INDEX idx_transactions_product_id ON public.transactions(product_id);
CREATE INDEX idx_transactions_date ON public.transactions(date DESC);
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies (only admins can manage roles)
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup - creates profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- Add color column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color text;
-- Drop existing public policies for update and delete on transactions
DROP POLICY IF EXISTS "Allow public update on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public delete on transactions" ON public.transactions;

-- Create admin-only policies for update and delete
CREATE POLICY "Admins can update transactions"
ON public.transactions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete transactions"
ON public.transactions
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
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
-- Create fournisseurs table
CREATE TABLE public.fournisseurs (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  matricule_fiscale TEXT,
  specialite TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow public read on fournisseurs" 
ON public.fournisseurs 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on fournisseurs" 
ON public.fournisseurs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on fournisseurs" 
ON public.fournisseurs 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on fournisseurs" 
ON public.fournisseurs 
FOR DELETE 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_fournisseurs_updated_at
BEFORE UPDATE ON public.fournisseurs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Fix products table: Remove public policies and add authenticated-only policies
DROP POLICY IF EXISTS "Allow public read on products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert on products" ON public.products;
DROP POLICY IF EXISTS "Allow public update on products" ON public.products;
DROP POLICY IF EXISTS "Allow public delete on products" ON public.products;

-- Create authenticated-only policies for products
CREATE POLICY "Authenticated users can read products"
ON public.products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
ON public.products FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also fix fournisseurs table (same issue)
DROP POLICY IF EXISTS "Allow public read on fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "Allow public insert on fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "Allow public update on fournisseurs" ON public.fournisseurs;
DROP POLICY IF EXISTS "Allow public delete on fournisseurs" ON public.fournisseurs;

CREATE POLICY "Authenticated users can read fournisseurs"
ON public.fournisseurs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert fournisseurs"
ON public.fournisseurs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update fournisseurs"
ON public.fournisseurs FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete fournisseurs"
ON public.fournisseurs FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also fix transactions table (same issue)
DROP POLICY IF EXISTS "Allow public read on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public insert on transactions" ON public.transactions;

CREATE POLICY "Authenticated users can read transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (true);
-- Fix documents table RLS policies to restrict access based on ownership

-- Drop all existing policies on documents table
DROP POLICY IF EXISTS "Allow authenticated read on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow authenticated insert on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow authenticated update on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow authenticated delete on documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;

-- Create owner-based read policy (users see their own documents, admins see all)
CREATE POLICY "Users can read own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Create insert policy that enforces ownership
CREATE POLICY "Users can create documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Create update policy for own documents or admin
CREATE POLICY "Users can update own documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Create delete policy (admin only for deletion)
CREATE POLICY "Admins can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
-- Fix transactions table: Restrict read access to admin and moderator roles only
-- This prevents regular employees from seeing all business transaction history

-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON public.transactions;

-- Create role-based read policy (admins and moderators only)
CREATE POLICY "Admins and moderators can read transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'moderator')
);

-- Also restrict INSERT to admin/moderator to maintain data integrity
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;

CREATE POLICY "Admins and moderators can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'moderator')
);
-- Drop overly permissive policies for products
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;

-- Create role-restricted policies for products (matching transactions pattern)
CREATE POLICY "Admins and moderators can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Admins and moderators can update products"
ON public.products FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);
-- Fix profiles table: users can only view their own profile, admins can view all
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles (separate policy for admin functions)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix fournisseurs table: restrict to admins and moderators only
DROP POLICY IF EXISTS "Authenticated users can read fournisseurs" ON public.fournisseurs;

-- Only admins and moderators can read fournisseurs
CREATE POLICY "Admins and moderators can read fournisseurs" 
ON public.fournisseurs 
FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role)
);
-- Fix fournisseurs INSERT policy: restrict to admins and moderators
DROP POLICY IF EXISTS "Authenticated users can insert fournisseurs" ON public.fournisseurs;

CREATE POLICY "Admins and moderators can insert fournisseurs" 
ON public.fournisseurs 
FOR INSERT 
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role)
);

-- Fix fournisseurs UPDATE policy: restrict to admins and moderators
DROP POLICY IF EXISTS "Authenticated users can update fournisseurs" ON public.fournisseurs;

CREATE POLICY "Admins and moderators can update fournisseurs" 
ON public.fournisseurs 
FOR UPDATE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role)
);
-- Fix products table: restrict SELECT to admins and moderators only
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;

-- Only admins and moderators can read products (business inventory data)
CREATE POLICY "Admins and moderators can read products" 
ON public.products 
FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role)
);
-- Drop the incorrect policy that uses 'id' instead of 'user_id'
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- The correct policy "Users can view their own profile" with (auth.uid() = user_id) already exists
-- Fix security: Ensure unauthenticated users cannot access any tables
-- The issue is that current policies don't explicitly block anonymous access
-- Solution: Recreate SELECT policies with explicit 'TO authenticated' clause

-- ============================================
-- FIX PROFILES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create new policies with explicit authentication requirement
CREATE POLICY "Authenticated users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- FIX FOURNISSEURS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins and moderators can read fournisseurs" ON public.fournisseurs;

CREATE POLICY "Admins and moderators can read fournisseurs"
ON public.fournisseurs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- ============================================
-- FIX PRODUCTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins and moderators can read products" ON public.products;

CREATE POLICY "Admins and moderators can read products"
ON public.products
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
-- Enable realtime for products table
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- Enable realtime for transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
-- MIGRATION PRODUIT/VARIANTE - Ã‰TAPE 1: CrÃ©ation de la table product_groups
-- Cette migration prÃ©serve 100% des donnÃ©es existantes

-- Table des groupes de produits (Produit logique)
CREATE TABLE public.product_groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_sku TEXT, -- Code article de rÃ©fÃ©rence (premier SKU du groupe)
    fournisseur TEXT,
    image TEXT, -- Image reprÃ©sentative du groupe
    min_stock INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- UnicitÃ© par nom + catÃ©gorie
    UNIQUE(name, category)
);

-- Ajouter la colonne product_group_id Ã  products (nullable pour migration progressive)
ALTER TABLE public.products 
ADD COLUMN product_group_id INTEGER REFERENCES public.product_groups(id) ON DELETE SET NULL;

-- Index pour performance
CREATE INDEX idx_products_group_id ON public.products(product_group_id);
CREATE INDEX idx_product_groups_category ON public.product_groups(category);
CREATE INDEX idx_product_groups_name ON public.product_groups(name);

-- Enable RLS on product_groups
ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour product_groups (mÃªmes que products)
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

-- MIGRATION DES DONNÃ‰ES: CrÃ©er les groupes Ã  partir des produits existants
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

-- Lier chaque produit Ã  son groupe
UPDATE public.products p
SET product_group_id = pg.id
FROM public.product_groups pg
WHERE p.name = pg.name AND p.category = pg.category;
-- Table pour le suivi de la prÃ©sence des utilisateurs en ligne
CREATE TABLE public.user_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_online BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Policies: Admins can see all, users can update their own
CREATE POLICY "Admins can read all presence" 
ON public.user_presence 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own presence" 
ON public.user_presence 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence" 
ON public.user_presence 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presence" 
ON public.user_presence 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable realtime for presence and product_groups tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_groups;
-- Create team chat messages table
CREATE TABLE public.team_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and moderators can view all messages
CREATE POLICY "Team members can view messages"
ON public.team_chat_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'moderator')
);

-- Policy: Admins and moderators can send messages
CREATE POLICY "Team members can send messages"
ON public.team_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.team_chat_messages
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_messages;

-- Create index for faster queries
CREATE INDEX idx_team_chat_created_at ON public.team_chat_messages(created_at DESC);
-- Drop existing restrictive policies on user_presence
DROP POLICY IF EXISTS "Admins can read all presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can delete their own presence" ON public.user_presence;

-- Recreate policies as PERMISSIVE (default)
-- Admins and moderators can read all presence
CREATE POLICY "Admins and moderators can read all presence" 
ON public.user_presence 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Users can insert their own presence
CREATE POLICY "Users can insert their own presence" 
ON public.user_presence 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own presence
CREATE POLICY "Users can update their own presence" 
ON public.user_presence 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own presence
CREATE POLICY "Users can delete their own presence" 
ON public.user_presence 
FOR DELETE 
USING (auth.uid() = user_id);
-- Create orders table for mobile app
CREATE TABLE IF NOT EXISTS public.orders (
  id SERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  items JSONB NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'En attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (admin/moderator)
CREATE POLICY "Allow authenticated insert on orders" 
ON public.orders FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated read on orders" 
ON public.orders FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated update on orders" 
ON public.orders FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete on orders" 
ON public.orders FOR DELETE 
TO authenticated
USING (true);

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_description TEXT;
-- Add remise (discount percentage) and prix_ttc (calculated total price) to products table
ALTER TABLE public.products 
ADD COLUMN remise numeric DEFAULT 0,
ADD COLUMN prix_ttc numeric GENERATED ALWAYS AS (price * (1 - remise / 100)) STORED;

-- Add comment for clarity
COMMENT ON COLUMN public.products.remise IS 'Discount percentage from supplier';
COMMENT ON COLUMN public.products.prix_ttc IS 'Final purchase price after discount (auto-calculated)';
-- Add UPDATE policy for admins to modify user roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Allow regular users to read products (view only)
CREATE POLICY "Users can read products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- Allow regular users to read product_groups (view only)
CREATE POLICY "Users can read product_groups"
ON public.product_groups
FOR SELECT
TO authenticated
USING (true);

-- Drop the restrictive policies and recreate them for admin/moderator only for write operations
-- (The existing SELECT policies for admin/moderator will remain, this adds a broader read policy)
-- Fix PUBLIC_DATA_EXPOSURE on orders table
-- Restrict access to admin and moderator roles for security

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated read on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated delete on orders" ON public.orders;

-- Create secure policies restricted to admin and moderator roles
CREATE POLICY "Admins and moderators can read orders"
ON public.orders FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can insert orders"
ON public.orders FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can update orders"
ON public.orders FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
-- Update team_chat_messages policies to allow all authenticated users

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Team members can view messages" ON public.team_chat_messages;
DROP POLICY IF EXISTS "Team members can send messages" ON public.team_chat_messages;

-- Create new policies for all authenticated users
CREATE POLICY "Authenticated users can view messages"
ON public.team_chat_messages FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can send messages"
ON public.team_chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);
-- Update documents RLS policies to allow moderators to edit and delete

-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;

-- Create new policies for admins AND moderators
CREATE POLICY "Admins and moderators can update documents"
ON public.documents FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can delete documents"
ON public.documents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
-- Create clients table
CREATE TABLE public.clients (
  id integer NOT NULL DEFAULT nextval('fournisseurs_id_seq'::regclass),
  nom text NOT NULL,
  matricule_fiscale text,
  location text,
  phone text,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create dedicated sequence for clients
CREATE SEQUENCE IF NOT EXISTS clients_id_seq;
ALTER TABLE public.clients ALTER COLUMN id SET DEFAULT nextval('clients_id_seq'::regclass);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients (admin and moderator access)
CREATE POLICY "Admins and moderators can read clients"
ON public.clients
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can insert clients"
ON public.clients
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can update clients"
ON public.clients
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can delete clients"
ON public.clients
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update products RLS: Allow moderators to delete products
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins and moderators can delete products"
ON public.products
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
-- Update product_groups RLS: Allow moderators to delete product groups
DROP POLICY IF EXISTS "Admins can delete product_groups" ON public.product_groups;
CREATE POLICY "Admins and moderators can delete product_groups"
ON public.product_groups
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
-- Remove email column from clients table
ALTER TABLE public.clients DROP COLUMN IF EXISTS email;
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

-- Create devis table for quotes management (no stock impact)
CREATE TABLE public.devis (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('entrant', 'sortant')),
  devis_number TEXT NOT NULL,
  devis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  third_party_name TEXT,
  third_party_address TEXT,
  third_party_tax_id TEXT,
  third_party_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'envoyÃ©', 'acceptÃ©', 'refusÃ©')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as documents)
CREATE POLICY "Users can read own devis" ON public.devis
  FOR SELECT USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create devis" ON public.devis
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own devis" ON public.devis
  FOR UPDATE USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and moderators can update devis" ON public.devis
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can delete devis" ON public.devis
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_devis_updated_at
  BEFORE UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Create storage bucket for fiches techniques
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiches-techniques', 'fiches-techniques', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload fiches techniques
CREATE POLICY "Authenticated users can upload fiches techniques"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'fiches-techniques' AND auth.uid() IS NOT NULL);

-- Allow public read access
CREATE POLICY "Public read access for fiches techniques"
ON storage.objects FOR SELECT
USING (bucket_id = 'fiches-techniques');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update fiches techniques"
ON storage.objects FOR UPDATE
USING (bucket_id = 'fiches-techniques' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete fiches techniques
CREATE POLICY "Authenticated users can delete fiches techniques"
ON storage.objects FOR DELETE
USING (bucket_id = 'fiches-techniques' AND auth.uid() IS NOT NULL);

-- Add fiche_technique_url column to product_group_fournisseurs
ALTER TABLE public.product_group_fournisseurs
ADD COLUMN fiche_technique_url text DEFAULT NULL;

ALTER TABLE public.devis ADD COLUMN is_ttc boolean NOT NULL DEFAULT true;

-- Drop the restrictive SELECT policy
DROP POLICY "Users can read own devis" ON public.devis;

-- Allow all authenticated users to read all devis
CREATE POLICY "All authenticated users can read devis"
ON public.devis
FOR SELECT
TO authenticated
USING (true);


-- Server-side dashboard stats function to avoid transferring all product data
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'totalProducts', COALESCE((SELECT COUNT(*) FROM products), 0),
    'totalValue', COALESCE((SELECT SUM(price * quantity) FROM products), 0),
    'lowStockCount', COALESCE((SELECT COUNT(*) FROM products WHERE quantity > 0 AND quantity <= min_stock), 0),
    'outOfStockCount', COALESCE((SELECT COUNT(*) FROM products WHERE quantity = 0), 0),
    'categoryValues', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT category, SUM(price * quantity) as value
        FROM products
        GROUP BY category
        ORDER BY SUM(price * quantity) DESC
      ) t),
      '[]'::json
    )
  );
$$;

CREATE POLICY "All authenticated users can read clients"
ON public.clients
FOR SELECT
TO authenticated
USING (true);
ALTER TABLE public.clients ADD COLUMN email text;

-- Allow users to delete their own devis
CREATE POLICY "Users can delete own devis"
ON public.devis
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Allow all authenticated users to update devis (not just admin/mod)
CREATE POLICY "All authenticated users can update devis"
ON public.devis
FOR UPDATE
TO authenticated
USING (true);


-- Drop the overly permissive policy
DROP POLICY "All authenticated users can update devis" ON public.devis;

-- Replace with proper scoped policy
CREATE POLICY "All authenticated users can update own devis"
ON public.devis
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));


-- Allow all authenticated users to read profiles (for displaying creator names)
CREATE POLICY "All authenticated users can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fiche_technique_url TEXT DEFAULT NULL;

-- Secure function to allow any authenticated user to update fiche_technique_url on products
CREATE OR REPLACE FUNCTION public.update_product_fiche_technique(
  _product_id integer,
  _fiche_technique_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE products
  SET fiche_technique_url = _fiche_technique_url,
      updated_at = now()
  WHERE id = _product_id;
END;
$$;


-- Drop and recreate with explicit null handling
CREATE OR REPLACE FUNCTION public.update_product_fiche_technique(
  _product_id integer,
  _fiche_technique_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE products
  SET fiche_technique_url = _fiche_technique_url,
      updated_at = now()
  WHERE id = _product_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_product_fiche_technique(
  _product_id integer,
  _fiche_technique_url text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE products
  SET fiche_technique_url = NULLIF(_fiche_technique_url, ''),
      updated_at = now()
  WHERE id = _product_id;
END;
$$;

CREATE POLICY "All authenticated users can read fournisseurs"
  ON public.fournisseurs FOR SELECT
  USING (true);

DROP POLICY "Admins and moderators can update devis" ON public.devis;
DROP POLICY "All authenticated users can update own devis" ON public.devis;
DROP POLICY "Users can update own devis" ON public.devis;

CREATE POLICY "All authenticated users can update devis"
  ON public.devis FOR UPDATE
  USING (true);


-- Drop existing restrictive policies on devis
DROP POLICY IF EXISTS "Admins and moderators can delete devis" ON public.devis;
DROP POLICY IF EXISTS "Users can delete own devis" ON public.devis;
DROP POLICY IF EXISTS "All authenticated users can read devis" ON public.devis;
DROP POLICY IF EXISTS "All authenticated users can update devis" ON public.devis;
DROP POLICY IF EXISTS "Users can create devis" ON public.devis;

-- Create open policies for all authenticated users
CREATE POLICY "All authenticated users can read devis"
ON public.devis FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can insert devis"
ON public.devis FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "All authenticated users can update devis"
ON public.devis FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can delete devis"
ON public.devis FOR DELETE
TO authenticated
USING (true);


-- Drop existing permissive policies for update and delete
DROP POLICY IF EXISTS "All authenticated users can update devis" ON public.devis;
DROP POLICY IF EXISTS "All authenticated users can delete devis" ON public.devis;

-- Admins and moderators can update/delete any devis
CREATE POLICY "Admins and moderators can update any devis"
ON public.devis FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can delete any devis"
ON public.devis FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Users can only update/delete their own devis
CREATE POLICY "Users can update own devis"
ON public.devis FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can delete own devis"
ON public.devis FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Allow all authenticated users to insert product_groups (for devis article creation)
CREATE POLICY "All users can insert product_groups"
ON public.product_groups FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to insert products (variants)
CREATE POLICY "All users can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to insert product_group_fournisseurs
CREATE POLICY "All users can insert product_group_fournisseurs"
ON public.product_group_fournisseurs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to insert transactions (needed for variant creation from devis)
CREATE POLICY "All users can insert transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (true);


CREATE TABLE public.category_settings (
  id SERIAL PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  color TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read category settings"
  ON public.category_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only moderators/admins can insert/update/delete
CREATE POLICY "Moderators can manage category settings"
  ON public.category_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'moderator')
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_settings;


-- Gallery items table (completely independent)
CREATE TABLE public.gallery_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GÃ©nÃ©ral',
  description TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "All authenticated can read gallery" ON public.gallery_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins and moderators can insert/update/delete
CREATE POLICY "Admins and mods can insert gallery" ON public.gallery_items
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and mods can update gallery" ON public.gallery_items
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and mods can delete gallery" ON public.gallery_items
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Storage bucket for gallery photos
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery-photos', 'gallery-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view gallery photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'gallery-photos');

CREATE POLICY "Auth users can upload gallery photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gallery-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete gallery photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'gallery-photos' AND auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_items;


CREATE TABLE public.gallery_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read gallery categories" ON public.gallery_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and mods can insert gallery categories" ON public.gallery_categories
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and mods can update gallery categories" ON public.gallery_categories
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and mods can delete gallery categories" ON public.gallery_categories
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Seed default categories
INSERT INTO public.gallery_categories (name) VALUES
  ('GÃ©nÃ©ral'), ('Produits'), ('Projets'), ('Installations'), ('Autres');

ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_categories;


-- Drop restrictive policies on gallery_items
DROP POLICY IF EXISTS "Admins and mods can delete gallery" ON public.gallery_items;
DROP POLICY IF EXISTS "Admins and mods can insert gallery" ON public.gallery_items;
DROP POLICY IF EXISTS "Admins and mods can update gallery" ON public.gallery_items;

-- Create open policies for all authenticated users
CREATE POLICY "All authenticated can insert gallery" ON public.gallery_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated can update gallery" ON public.gallery_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All authenticated can delete gallery" ON public.gallery_items FOR DELETE TO authenticated USING (true);

-- Drop restrictive policies on gallery_categories
DROP POLICY IF EXISTS "Admins and mods can delete gallery categories" ON public.gallery_categories;
DROP POLICY IF EXISTS "Admins and mods can insert gallery categories" ON public.gallery_categories;
DROP POLICY IF EXISTS "Admins and mods can update gallery categories" ON public.gallery_categories;

-- Create open policies for all authenticated users
CREATE POLICY "All authenticated can insert gallery categories" ON public.gallery_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated can update gallery categories" ON public.gallery_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All authenticated can delete gallery categories" ON public.gallery_categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "All authenticated users can insert clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE TABLE public.echantillons (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  devis_id integer NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'envoyÃ©',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.echantillons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read echantillons"
  ON public.echantillons FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert echantillons"
  ON public.echantillons FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update echantillons"
  ON public.echantillons FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete echantillons"
  ON public.echantillons FOR DELETE TO authenticated
  USING (true);


-- Create bons_commande table
CREATE TABLE public.bons_commande (
  id integer NOT NULL DEFAULT nextval(pg_catalog.pg_get_serial_sequence('devis', 'id')),
  bc_number text NOT NULL,
  bc_date date NOT NULL DEFAULT CURRENT_DATE,
  devis_id integer REFERENCES public.devis(id) ON DELETE SET NULL,
  type text NOT NULL,
  third_party_name text,
  third_party_address text,
  third_party_tax_id text,
  third_party_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'confirmÃ©',
  is_ttc boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create a dedicated sequence
CREATE SEQUENCE IF NOT EXISTS bons_commande_id_seq;
ALTER TABLE public.bons_commande ALTER COLUMN id SET DEFAULT nextval('bons_commande_id_seq');
ALTER SEQUENCE bons_commande_id_seq OWNED BY public.bons_commande.id;

-- Primary key
ALTER TABLE public.bons_commande ADD PRIMARY KEY (id);

-- Enable RLS
ALTER TABLE public.bons_commande ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as devis)
CREATE POLICY "All authenticated users can read bons_commande"
  ON public.bons_commande FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert bons_commande"
  ON public.bons_commande FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins and moderators can update any bon_commande"
  ON public.bons_commande FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can update own bons_commande"
  ON public.bons_commande FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Admins and moderators can delete any bon_commande"
  ON public.bons_commande FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can delete own bons_commande"
  ON public.bons_commande FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_bons_commande_updated_at
  BEFORE UPDATE ON public.bons_commande
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS is_bc boolean NOT NULL DEFAULT false;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS source_devis_id integer REFERENCES public.devis(id) ON DELETE SET NULL;


ALTER TABLE public.devis DROP CONSTRAINT devis_status_check;
ALTER TABLE public.devis ADD CONSTRAINT devis_status_check CHECK (status = ANY (ARRAY['brouillon'::text, 'envoyÃ©'::text, 'acceptÃ©'::text, 'refusÃ©'::text, 'confirmÃ©'::text]));


-- Create storage bucket for client patentes (PRIVATE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patentes_client', 'patentes_client', false)
ON CONFLICT (id) DO NOTHING;

-- Allow ONLY authenticated users to read the patente images
CREATE POLICY "Authenticated read access for patentes"
ON storage.objects FOR SELECT
USING (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to upload new patentes
CREATE POLICY "Authenticated users can upload patentes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update patentes"
ON storage.objects FOR UPDATE
USING (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete patentes
CREATE POLICY "Authenticated users can delete patentes"
ON storage.objects FOR DELETE
USING (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);

-- Add patente_url column to clients table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'patente_url') THEN
        ALTER TABLE public.clients ADD COLUMN patente_url TEXT DEFAULT NULL;
    END IF;
END $$;

-- Add patente_url column to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS patente_url text;

-- Create storage bucket for patentes
INSERT INTO storage.buckets (id, name, public) VALUES ('patentes_client', 'patentes_client', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload patentes" ON storage.objects;
CREATE POLICY "Authenticated users can upload patentes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patentes_client');

DROP POLICY IF EXISTS "Authenticated users can view patentes" ON storage.objects;
CREATE POLICY "Authenticated users can view patentes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patentes_client');

DROP POLICY IF EXISTS "Authenticated users can delete patentes" ON storage.objects;
CREATE POLICY "Authenticated users can delete patentes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patentes_client');


-- 1. Create the bucket for Registre de Commerce (PRIVATE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('registre_commerce_client', 'registre_commerce_client', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies for RC bucket
CREATE POLICY "Lecture sÃ©curisÃ©e RC" ON storage.objects
FOR SELECT USING (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);

CREATE POLICY "Upload RC" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);

CREATE POLICY "Modif RC" ON storage.objects
FOR UPDATE USING (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);

CREATE POLICY "Suppression RC" ON storage.objects
FOR DELETE USING (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);

-- 3. Add registre_commerce_url column to clients table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'registre_commerce_url') THEN
        ALTER TABLE public.clients ADD COLUMN registre_commerce_url TEXT DEFAULT NULL;
    END IF;
END $$;


-- 1. Add Code column to Clients and Fournisseurs
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE public.fournisseurs ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- 2. Create sequences for formatting
CREATE SEQUENCE IF NOT EXISTS clients_code_seq;
CREATE SEQUENCE IF NOT EXISTS fournisseurs_code_seq;

-- 3. Create the function to automatically generate codes
CREATE OR REPLACE FUNCTION generate_entity_code()
RETURNS TRIGGER AS $$
DECLARE
    seq_name TEXT;
    prefix TEXT;
    next_val INT;
BEGIN
    -- Only generate if code is null
    IF NEW.code IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'clients' THEN
        seq_name := 'clients_code_seq';
        prefix := 'C';
    ELSIF TG_TABLE_NAME = 'fournisseurs' THEN
        seq_name := 'fournisseurs_code_seq';
        prefix := 'F';
    ELSE
        RETURN NEW;
    END IF;

    -- Get next value from sequence
    EXECUTE 'SELECT nextval(''' || seq_name || ''')' INTO next_val;
    
    -- Format: C00001
    NEW.code := prefix || LPAD(next_val::TEXT, 5, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create triggers
DROP TRIGGER IF EXISTS tr_generate_client_code ON public.clients;
CREATE TRIGGER tr_generate_client_code
BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION generate_entity_code();

DROP TRIGGER IF EXISTS tr_generate_fournisseur_code ON public.fournisseurs;
CREATE TRIGGER tr_generate_fournisseur_code
BEFORE INSERT ON public.fournisseurs
FOR EACH ROW EXECUTE FUNCTION generate_entity_code();

-- 5. Populate existing records (ordered by creation date)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Clients
    FOR r IN SELECT id FROM public.clients WHERE code IS NULL ORDER BY created_at ASC LOOP
        UPDATE public.clients SET code = 'C' || LPAD(nextval('clients_code_seq')::TEXT, 5, '0') WHERE id = r.id;
    END LOOP;
    
    -- Fournisseurs
    FOR r IN SELECT id FROM public.fournisseurs WHERE code IS NULL ORDER BY created_at ASC LOOP
        UPDATE public.fournisseurs SET code = 'F' || LPAD(nextval('fournisseurs_code_seq')::TEXT, 5, '0') WHERE id = r.id;
    END LOOP;
END $$;


-- 1. Create the app_config table
CREATE TABLE IF NOT EXISTS public.app_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Everyone can read config
CREATE POLICY "Public read access for app_config" ON public.app_config
FOR SELECT TO authenticated USING (true);

-- Only admins can update config
CREATE POLICY "Admin update access for app_config" ON public.app_config
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. Initial seed
INSERT INTO public.app_config (key, value)
VALUES ('update_alert_version', '1.0.0')
ON CONFLICT (key) DO NOTHING;


-- Add is_ba column to devis table
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS is_ba boolean NOT NULL DEFAULT false;

-- Add registre_commerce_url column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registre_commerce_url text;

-- Create storage bucket for registre de commerce
INSERT INTO storage.buckets (id, name, public)
VALUES ('registre_commerce', 'registre_commerce', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for registre_commerce bucket
CREATE POLICY "Authenticated users can upload registre_commerce"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'registre_commerce');

CREATE POLICY "Authenticated users can view registre_commerce"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'registre_commerce');

CREATE POLICY "Admins and moderators can delete registre_commerce"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'registre_commerce' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
));

CREATE POLICY "Authenticated users can update registre_commerce"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'registre_commerce');

INSERT INTO storage.buckets (id, name, public) VALUES ('registre_commerce_client', 'registre_commerce_client', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload registre_commerce_client"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'registre_commerce_client');

CREATE POLICY "Authenticated users can view registre_commerce_client"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'registre_commerce_client');

CREATE POLICY "Authenticated users can update registre_commerce_client"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'registre_commerce_client');

CREATE POLICY "Admins and moderators can delete registre_commerce_client"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'registre_commerce_client' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
));

