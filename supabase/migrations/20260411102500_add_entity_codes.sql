
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
