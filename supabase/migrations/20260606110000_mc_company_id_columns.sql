-- =============================================================================
-- MULTI-COMPANY: add company_id to operational tables (Phase 2)
--
-- Uses public.mc_setup_company_column() (defined in 20260606100000) to apply the
-- same proven pattern to every "directly-queried" table:
--   add column -> backfill Grosafe -> NOT NULL -> FK -> index -> default trigger.
--
-- Pure line/child tables (document_lines, echantillons, product_group_fournisseurs,
-- hr_employee_leaves, hr_payroll_movements, payroll_slips) are intentionally NOT
-- given a column here: they are isolated via parent EXISTS() in the RLS phase.
--
-- Shared taxonomies (category_settings, gallery_categories) stay global on purpose.
-- =============================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- inventory
    'products', 'product_groups', 'transactions', 'orders',
    -- commercial documents
    'devis', 'bons_commande', 'documents', 'factures', 'rdvs', 'gallery_items',
    -- fleet
    'vehicles', 'fuel_vouchers', 'fuel_cards', 'maintenance', 'vehicle_charges', 'vehicle_reminders',
    -- HR / planning
    'employees', 'plannings', 'hr_employees', 'rh_security_reports'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    PERFORM public.mc_setup_company_column(t);
  END LOOP;
END $$;
