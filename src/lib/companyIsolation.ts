/**
 * Multi-company isolation contract.
 *
 * Authoritative boundary = Postgres RLS (user_company_ids). The app adds
 * defense-in-depth filters via getActiveCompanyId / withCompany on list/insert
 * paths for multi-company users. This module is the single registry used by
 * automated isolation tests to audit migrations and critical frontend modules.
 */

/** Tables with a direct company_id column (Phase 2 migration). */
export const DIRECT_COMPANY_SCOPED_TABLES = [
  'products',
  'product_groups',
  'transactions',
  'orders',
  'devis',
  'bons_commande',
  'documents',
  'factures',
  'rdvs',
  'gallery_items',
  'vehicles',
  'fuel_vouchers',
  'fuel_cards',
  'maintenance',
  'vehicle_charges',
  'vehicle_reminders',
  'employees',
  'plannings',
  'hr_employees',
  'rh_security_reports',
  'clients',
  'fournisseurs',
] as const;

/** Child tables isolated via parent EXISTS() policies (no company_id column). */
export const CHILD_COMPANY_SCOPED_TABLES: ReadonlyArray<{
  table: string;
  parent: string;
}> = [
  { table: 'document_lines', parent: 'documents' },
  { table: 'echantillons', parent: 'devis' },
  { table: 'product_group_fournisseurs', parent: 'product_groups' },
  { table: 'hr_employee_leaves', parent: 'hr_employees' },
  { table: 'hr_payroll_movements', parent: 'hr_employees' },
  { table: 'fuel_card_history', parent: 'fuel_cards' },
];

/** Per-company composite unique columns (Phase 7). */
export const PER_COMPANY_UNIQUE_COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'vehicles', column: 'matricule' },
  { table: 'fuel_vouchers', column: 'num_bon' },
  { table: 'fuel_cards', column: 'num_carte' },
  { table: 'clients', column: 'code' },
  { table: 'fournisseurs', column: 'code' },
  { table: 'documents', column: 'numero' },
];

/**
 * Frontend modules that must actively filter/stamp company_id for multi-company
 * users (RLS still applies, but explicit filters prevent wrong-company UI).
 */
export const FRONTEND_COMPANY_SCOPED_MODULES: ReadonlyArray<{
  path: string;
  requiredMarkers: string[];
}> = [
  { path: 'src/modules/inventory/services/productRepository.ts', requiredMarkers: ['getActiveCompanyId', 'filterByCompanyId', 'withCompany'] },
  { path: 'src/modules/inventory/services/backupRepository.ts', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/services/productGroupService.ts', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/modules/commercial/services/documentService.ts', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/components/Clients.tsx', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/components/Fournisseurs.tsx', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/components/GestionDevis.tsx', requiredMarkers: ['getActiveCompanyId', 'useDevisDocumentList', 'useDevisPersistence'] },
  { path: 'src/modules/commercial/quotations/hooks/useDevisDocumentList.ts', requiredMarkers: ['getActiveCompanyId', 'filterByCompanyId'] },
  { path: 'src/modules/commercial/quotations/services/devisPersistenceService.ts', requiredMarkers: ['requireActiveCompanyId', 'company_id', 'filterByCompanyId'] },
  { path: 'src/modules/commercial/quotations/services/devisRepository.ts', requiredMarkers: ['requireActiveCompanyId', 'filterByCompanyId'] },
  { path: 'src/components/devis/DevisForm.tsx', requiredMarkers: ['useDevisParties', 'useDevisNewPartyDialogs', 'useDevisArticleDialogs'] },
  { path: 'src/modules/commercial/quotations/hooks/useDevisParties.ts', requiredMarkers: ['getActiveCompanyId', 'filterByCompanyId'] },
  { path: 'src/modules/commercial/quotations/hooks/useDevisNewPartyDialogs.ts', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/modules/commercial/quotations/hooks/useDevisArticleDialogs.ts', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/components/Flotte.tsx', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/lib/fuelCardRepository.ts', requiredMarkers: ['getActiveCompanyId', 'filterByCompanyId', 'withCompany', 'requireActiveCompanyId'] },
  { path: 'src/components/vehicules/CartesCarburant.tsx', requiredMarkers: ['getActiveCompanyId', 'filterByCompanyId', 'useCompanyChangeReload'] },
  { path: 'src/lib/tenantService.ts', requiredMarkers: ['provision_my_tenant', 'get_my_tenant'] },
  { path: 'src/pages/Signup.tsx', requiredMarkers: ['provisionMyTenant', 'signUp'] },
  { path: 'src/components/EmployeeList.tsx', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/components/rh/HrEmployeesList.tsx', requiredMarkers: ['getActiveCompanyId', 'company_id'] },
  { path: 'src/contexts/AppCompanyContext.tsx', requiredMarkers: ['list_my_companies', 'resolveActiveCompanyId'] },
  { path: 'src/lib/activeCompany.ts', requiredMarkers: ['resolveActiveCompanyId', 'withCompany'] },
];

/** company_id added in an earlier migration (pre-Phase 2). */
export const EARLIER_COMPANY_ID_TABLES = ['clients', 'fournisseurs'] as const;

export const MC_MIGRATION_FILES = {
  foundation: '20260606100000_mc_foundation.sql',
  companyColumns: '20260606110000_mc_company_id_columns.sql',
  clientsFournisseurs: '20260602120000_clients_fournisseurs_multi_company.sql',
  rls: '20260606120000_mc_rls_policies.sql',
  rpcs: '20260606130000_mc_company_aware_rpcs.sql',
  uniques: '20260606140000_mc_unique_constraints.sql',
  fuelCards: '20260709130000_create_fuel_cards_table.sql',
  fuelCardHistory: '20260709140000_fuel_cards_conducteur_and_history.sql',
  saasTenants: '20260709160000_saas_tenants_foundation.sql',
  platformAdmins: '20260710120000_platform_admins.sql',
} as const;
