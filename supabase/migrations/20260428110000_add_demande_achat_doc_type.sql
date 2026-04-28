DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'DEMANDE_ACHAT'
      AND enumtypid = 'doc_type'::regtype
  ) THEN
    ALTER TYPE public.doc_type ADD VALUE 'DEMANDE_ACHAT';
  END IF;
END $$;
