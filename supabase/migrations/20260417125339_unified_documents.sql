-- 1. Create Enums for Document Type and Status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_type') THEN
        CREATE TYPE doc_type AS ENUM (
            'BC_CLIENT', 
            'DEVIS_FOURNISSEUR', 
            'BC_FOURNISSEUR', 
            'BL_FOURNISSEUR', 
            'BE', 
            'BS', 
            'BL_CLIENT', 
            'FACTURE'
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_status') THEN
        CREATE TYPE doc_status AS ENUM (
            'DRAFT', 
            'PENDING', 
            'VALIDATED', 
            'COMPLETED', 
            'REJECTED'
        );
    END IF;
END $$;

-- 2. Preserve existing documents table (Safety)
ALTER TABLE IF EXISTS documents RENAME TO documents_legacy;

-- 3. Create NEW unified documents table
CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero text NOT NULL UNIQUE,
    type doc_type NOT NULL,
    status doc_status NOT NULL DEFAULT 'DRAFT',
    
    -- Links (bigint to match existing tables)
    client_id bigint REFERENCES clients(id) ON DELETE SET NULL,
    fournisseur_id bigint REFERENCES fournisseurs(id) ON DELETE SET NULL,
    parent_id uuid REFERENCES documents(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    notes text,
    
    -- For backward compatibility/extra info
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 4. Create document lines table
CREATE TABLE document_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    product_id bigint REFERENCES products(id) ON DELETE SET NULL,
    
    quantity numeric NOT NULL DEFAULT 1,
    unit_price numeric NOT NULL DEFAULT 0,
    total_price numeric NOT NULL DEFAULT 0,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Optional: for non-inventory items
    description text
);

-- 5. Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_lines ENABLE ROW LEVEL SECURITY;

-- 6. Basic RLS Policies (Allow all authenticated users for now)
CREATE POLICY "Enable read access for all users" ON documents FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON documents FOR UPDATE USING (true);

CREATE POLICY "Enable read for all users lines" ON document_lines FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users lines" ON document_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users lines" ON document_lines FOR UPDATE USING (true);

-- 7. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_lines_updated_at
    BEFORE UPDATE ON document_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
