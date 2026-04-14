-- Drop the foreign key constraint on documents.created_by that blocks data imports
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_created_by_fkey;