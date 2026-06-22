-- =============================================================================
-- FIX: Commercial document numbering uniqueness
-- The unique indices on devis_number and bc_number were enforcing global
-- uniqueness across all companies. This migration converts them to be
-- unique per company (company_id).
-- =============================================================================

DO $$
BEGIN
  -- Call the function created in 20260606140000_mc_unique_constraints.sql
  PERFORM public.mc_make_company_unique('devis', 'devis_number');
  PERFORM public.mc_make_company_unique('bons_commande', 'bc_number');
END $$;
