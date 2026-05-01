-- ==========================================
-- SUPABASE FULL SCHEMA (VALIDATED FOR EXECUTION)
-- ==========================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.doc_status AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS app_config_id_seq;
CREATE SEQUENCE IF NOT EXISTS bons_commande_id_seq;
CREATE SEQUENCE IF NOT EXISTS category_settings_id_seq;
CREATE SEQUENCE IF NOT EXISTS clients_id_seq;
CREATE SEQUENCE IF NOT EXISTS devis_id_seq;
CREATE SEQUENCE IF NOT EXISTS documents_id_seq;
CREATE SEQUENCE IF NOT EXISTS fournisseurs_id_seq;
CREATE SEQUENCE IF NOT EXISTS gallery_categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS gallery_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS orders_id_seq;
CREATE SEQUENCE IF NOT EXISTS product_group_fournisseurs_id_seq;
CREATE SEQUENCE IF NOT EXISTS product_groups_id_seq;
CREATE SEQUENCE IF NOT EXISTS products_id_seq;
CREATE SEQUENCE IF NOT EXISTS transactions_id_seq;
CREATE SEQUENCE IF NOT EXISTS clients_code_seq;
CREATE SEQUENCE IF NOT EXISTS fournisseurs_code_seq;

-- 3. TABLES (Ordered by Dependency)

-- Independent Tables
CREATE TABLE IF NOT EXISTS public.app_config (
  id bigint NOT NULL DEFAULT nextval('app_config_id_seq'::regclass),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_config_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.category_settings (
  id integer NOT NULL DEFAULT nextval('category_settings_id_seq'::regclass),
  category_name text NOT NULL UNIQUE,
  color text,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT category_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fournisseurs (
  id integer NOT NULL DEFAULT nextval('fournisseurs_id_seq'::regclass),
  nom text NOT NULL,
  matricule_fiscale text,
  specialite text NOT NULL,
  phone text,
  location text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  code text UNIQUE,
  CONSTRAINT fournisseurs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.clients (
  id integer NOT NULL DEFAULT nextval('clients_id_seq'::regclass),
  nom text NOT NULL,
  matricule_fiscale text,
  location text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  patente_url text,
  registre_commerce_url text,
  code text UNIQUE,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modele TEXT NOT NULL,
  matricule TEXT NOT NULL UNIQUE,
  type TEXT,
  constructeur TEXT,
  type_carburant TEXT NOT NULL DEFAULT 'gasoil',
  kilometrage_actuel NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gallery_categories (
  id integer NOT NULL DEFAULT nextval('gallery_categories_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gallery_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.product_groups (
  id integer NOT NULL DEFAULT nextval('product_groups_id_seq'::regclass),
  name text NOT NULL,
  category text NOT NULL,
  base_sku text,
  fournisseur text,
  image text,
  min_stock integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_groups_pkey PRIMARY KEY (id)
);

-- Dependent Tables (Level 1)

CREATE TABLE IF NOT EXISTS public.products (
  id integer NOT NULL DEFAULT nextval('products_id_seq'::regclass),
  name text NOT NULL,
  sku text NOT NULL,
  category text NOT NULL,
  fournisseur text,
  size text,
  quantity integer NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 5,
  image text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  color text,
  product_group_id integer REFERENCES public.product_groups(id) ON DELETE SET NULL,
  remise numeric DEFAULT 0,
  prix_ttc numeric DEFAULT 0, -- Will be updated by trigger or app logic
  fiche_technique_url text,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.product_group_fournisseurs (
  id integer NOT NULL DEFAULT nextval('product_group_fournisseurs_id_seq'::regclass),
  product_group_id integer NOT NULL REFERENCES public.product_groups(id) ON DELETE CASCADE,
  fournisseur_name text NOT NULL,
  prix_ttc numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  fiche_technique_url text,
  CONSTRAINT product_group_fournisseurs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.devis (
  id integer NOT NULL DEFAULT nextval('devis_id_seq'::regclass),
  type text NOT NULL,
  devis_number text NOT NULL,
  devis_date date NOT NULL DEFAULT CURRENT_DATE,
  third_party_name text,
  third_party_address text,
  third_party_tax_id text,
  third_party_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'brouillon'::text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_ttc boolean NOT NULL DEFAULT true,
  is_bc boolean NOT NULL DEFAULT false,
  source_devis_id integer REFERENCES public.devis(id),
  is_ba boolean NOT NULL DEFAULT false,
  CONSTRAINT devis_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  CONSTRAINT user_presence_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fuel_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_bon TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  montant NUMERIC NOT NULL DEFAULT 0,
  conducteur_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  vehicule_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  type_carburant TEXT DEFAULT 'gasoil',
  notes TEXT,
  status TEXT DEFAULT 'en_attente',
  km NUMERIC,
  distance NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicule_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  date_debut DATE NOT NULL,
  date_fin DATE,
  description TEXT,
  cout_estime NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'en_cours',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicule_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  date_echeance DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dependent Tables (Level 2)

CREATE TABLE IF NOT EXISTS public.bons_commande (
  id integer NOT NULL DEFAULT nextval('bons_commande_id_seq'::regclass),
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
  status text NOT NULL DEFAULT 'confirmé'::text,
  is_ttc boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bons_commande_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id integer NOT NULL DEFAULT nextval('transactions_id_seq'::regclass),
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  type text NOT NULL,
  quantity integer NOT NULL,
  date timestamp with time zone NOT NULL DEFAULT now(),
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.echantillons (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  devis_id integer NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'envoyé'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT echantillons_pkey PRIMARY KEY (id)
);

-- Legacy/Others
CREATE TABLE IF NOT EXISTS public.orders (
  id integer NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
  client_name text NOT NULL,
  client_phone text,
  items jsonb NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'En attente'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  client_description text,
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fuel_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_carte TEXT NOT NULL UNIQUE,
  solde NUMERIC NOT NULL DEFAULT 0,
  type TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plannings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  site_name TEXT,
  period_type TEXT,
  reference_date DATE,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_email text NOT NULL,
  user_role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_chat_messages_pkey PRIMARY KEY (id)
);

-- 4. RLS & TRIGGERS

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all relevant tables
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fuel_cards_updated_at BEFORE UPDATE ON public.fuel_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plannings_updated_at BEFORE UPDATE ON public.plannings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bons_commande_updated_at BEFORE UPDATE ON public.bons_commande FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plannings ENABLE ROW LEVEL SECURITY;

-- Basic Policies for Authenticated Users
CREATE POLICY "Auth select vehicles" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth select employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth select plannings" ON public.plannings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert plannings" ON public.plannings FOR INSERT TO authenticated WITH CHECK (true);
