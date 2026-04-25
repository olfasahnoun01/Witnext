-- Fix typo in user_section_permissions table name if it was created as "user_section_permissons"
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_section_permissons') THEN
        ALTER TABLE public.user_section_permissons RENAME TO user_section_permissions;
    END IF;
END $$;

-- Ensure the correct table exists if it didn't already
CREATE TABLE IF NOT EXISTS public.user_section_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  subsection_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section_key, subsection_key)
);

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
