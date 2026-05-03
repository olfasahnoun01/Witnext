-- Liste les societes Finance pour l'utilisateur connecte (evite les cas RLS croises client).
CREATE OR REPLACE FUNCTION public.finance_list_my_companies ()
RETURNS SETOF public.companies
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.companies c
  INNER JOIN public.user_companies uc ON uc.company_id = c.id
  WHERE uc.user_id = auth.uid ();
$$;

REVOKE ALL ON FUNCTION public.finance_list_my_companies () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_list_my_companies () TO authenticated;

COMMENT ON FUNCTION public.finance_list_my_companies () IS 'Module Finance: societes liees a auth.uid() dans user_companies.';
