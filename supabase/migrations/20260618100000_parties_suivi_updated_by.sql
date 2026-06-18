-- Track who last edited a suivi line (for "Modifié par" column).
ALTER TABLE public.parties_suivi
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.parties_suivi.updated_by IS 'Last editor when different from created_by';
