-- TEJ (retenue à la source) : matricule déclarant + champs certificat pour export XML.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS matricule_fiscal text,
  ADD COLUMN IF NOT EXISTS categorie_contribuable text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_categorie_contribuable_chk'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_categorie_contribuable_chk
      CHECK (categorie_contribuable IS NULL OR categorie_contribuable IN ('PM', 'PP'));
  END IF;
END $$;

COMMENT ON COLUMN public.companies.matricule_fiscal IS
  'Matricule fiscal TEJ (7 chiffres + clé alphabétique), ex. 0001238L.';
COMMENT ON COLUMN public.companies.categorie_contribuable IS
  'PM = personne morale, PP = personne physique (déclarant TEJ).';

ALTER TABLE public.withholding_certificates
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS ref_certif text,
  ADD COLUMN IF NOT EXISTS beneficiaire jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.withholding_certificates.payment_date IS
  'Date de paiement (évènement TEJ DatePayement).';
COMMENT ON COLUMN public.withholding_certificates.ref_certif IS
  'Référence certificat chez le déclarant (Ref_certif_chez_declarant).';
COMMENT ON COLUMN public.withholding_certificates.beneficiaire IS
  'Infos bénéficiaire TEJ: categorie, resident, adresse, activite, email, tel.';

-- Backfill payment_date depuis payments si lié.
UPDATE public.withholding_certificates wc
SET payment_date = p.payment_date::date
FROM public.payments p
WHERE wc.payment_id = p.id
  AND wc.payment_date IS NULL;

UPDATE public.withholding_certificates
SET payment_date = created_at::date
WHERE payment_date IS NULL;

UPDATE public.withholding_certificates
SET ref_certif = id
WHERE ref_certif IS NULL OR trim(ref_certif) = '';

CREATE INDEX IF NOT EXISTS withholding_certificates_company_payment_date_idx
  ON public.withholding_certificates (company_id, payment_date);
