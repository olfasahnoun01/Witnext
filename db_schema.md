-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_config (
  id bigint NOT NULL DEFAULT nextval('app_config_id_seq'::regclass),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bons_commande (
  id integer NOT NULL DEFAULT nextval('bons_commande_id_seq'::regclass),
  bc_number text NOT NULL,
  bc_date date NOT NULL DEFAULT CURRENT_DATE,
  devis_id integer,
  type text NOT NULL,
  third_party_name text,
  third_party_address text,
  third_party_tax_id text,
  third_party_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'confirmÃ©'::text,
  is_ttc boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bons_commande_pkey PRIMARY KEY (id),
  CONSTRAINT bons_commande_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id)
);
CREATE TABLE public.category_settings (
  id integer NOT NULL DEFAULT nextval('category_settings_id_seq'::regclass),
  category_name text NOT NULL UNIQUE,
  color text,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT category_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clients (
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
CREATE TABLE public.devis (
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
  source_devis_id integer,
  is_ba boolean NOT NULL DEFAULT false,
  CONSTRAINT devis_pkey PRIMARY KEY (id),
  CONSTRAINT devis_source_devis_id_fkey FOREIGN KEY (source_devis_id) REFERENCES public.devis(id)
);
CREATE TABLE public.document_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  product_id integer,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  description text,
  CONSTRAINT document_lines_pkey PRIMARY KEY (id),
  CONSTRAINT document_lines_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id),
  CONSTRAINT document_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  type USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'DRAFT'::doc_status,
  client_id integer,
  fournisseur_id integer,
  parent_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT documents_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id),
  CONSTRAINT documents_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.documents(id),
  CONSTRAINT documents_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.documents_legacy (
  id integer NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
  type text NOT NULL,
  doc_number text NOT NULL,
  doc_date date NOT NULL DEFAULT CURRENT_DATE,
  validity text,
  transport_ref text,
  third_party_name text,
  third_party_address text,
  third_party_tax_id text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT documents_legacy_pkey PRIMARY KEY (id),
  CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.echantillons (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  devis_id integer NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'envoyÃ©'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT echantillons_pkey PRIMARY KEY (id),
  CONSTRAINT echantillons_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id)
);
CREATE TABLE public.fournisseurs (
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
CREATE TABLE public.gallery_categories (
  id integer NOT NULL DEFAULT nextval('gallery_categories_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gallery_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.gallery_items (
  id integer NOT NULL DEFAULT nextval('gallery_items_id_seq'::regclass),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'GÃ©nÃ©ral'::text,
  description text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gallery_items_pkey PRIMARY KEY (id),
  CONSTRAINT gallery_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.orders (
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
CREATE TABLE public.product_group_fournisseurs (
  id integer NOT NULL DEFAULT nextval('product_group_fournisseurs_id_seq'::regclass),
  product_group_id integer NOT NULL,
  fournisseur_name text NOT NULL,
  prix_ttc numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  fiche_technique_url text,
  CONSTRAINT product_group_fournisseurs_pkey PRIMARY KEY (id),
  CONSTRAINT product_group_fournisseurs_product_group_id_fkey FOREIGN KEY (product_group_id) REFERENCES public.product_groups(id)
);
CREATE TABLE public.product_groups (
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
CREATE TABLE public.products (
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
  product_group_id integer,
  remise numeric DEFAULT 0,
  prix_ttc numeric DEFAULT (price * ((1)::numeric - (remise / (100)::numeric))),
  fiche_technique_url text,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_product_group_id_fkey FOREIGN KEY (product_group_id) REFERENCES public.product_groups(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id integer,
  document_id uuid,
  type text NOT NULL,
  quantity numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT stock_movements_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id)
);
CREATE TABLE public.team_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  user_role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_chat_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id integer NOT NULL DEFAULT nextval('transactions_id_seq'::regclass),
  product_id integer NOT NULL,
  product_name text NOT NULL,
  type text NOT NULL,
  quantity integer NOT NULL,
  date timestamp with time zone NOT NULL DEFAULT now(),
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.user_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  role text,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  CONSTRAINT user_presence_pkey PRIMARY KEY (id),
  CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);