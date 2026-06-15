CREATE TABLE IF NOT EXISTS public.parties_suivi (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  party_type text NOT NULL CHECK (party_type IN ('client', 'fournisseur')),
  devis_date date,
  devis_number text,
  societe text NOT NULL,
  telephone text,
  reponse text,
  dernier_contact_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS parties_suivi_company_type_idx
  ON public.parties_suivi (company_id, party_type);

DROP TRIGGER IF EXISTS parties_suivi_updated_at ON public.parties_suivi;
CREATE TRIGGER parties_suivi_updated_at
  BEFORE UPDATE ON public.parties_suivi
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.parties_suivi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parties_suivi_select_company ON public.parties_suivi;
CREATE POLICY parties_suivi_select_company ON public.parties_suivi
  FOR SELECT TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS parties_suivi_insert_company ON public.parties_suivi;
CREATE POLICY parties_suivi_insert_company ON public.parties_suivi
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS parties_suivi_update_company ON public.parties_suivi;
CREATE POLICY parties_suivi_update_company ON public.parties_suivi
  FOR UPDATE TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  )
  WITH CHECK (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );

DROP POLICY IF EXISTS parties_suivi_delete_company ON public.parties_suivi;
CREATE POLICY parties_suivi_delete_company ON public.parties_suivi
  FOR DELETE TO authenticated
  USING (
    company_id = public.grosafe_company_id()
    OR company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ())
  );
