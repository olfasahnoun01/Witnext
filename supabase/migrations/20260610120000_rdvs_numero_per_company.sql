-- RDV numbers are scoped per company (same pattern as documents / fuel vouchers).
-- Replaces global rdvs_numero_key with (company_id, numero) uniqueness.
DO $$
BEGIN
  PERFORM public.mc_make_company_unique('rdvs', 'numero');
END $$;
