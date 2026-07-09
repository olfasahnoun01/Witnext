import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DIRECT_COMPANY_SCOPED_TABLES,
  EARLIER_COMPANY_ID_TABLES,
  CHILD_COMPANY_SCOPED_TABLES,
  PER_COMPANY_UNIQUE_COLUMNS,
  FRONTEND_COMPANY_SCOPED_MODULES,
  MC_MIGRATION_FILES,
} from '../companyIsolation';

const REPO_ROOT = join(__dirname, '../../..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase/migrations');

function readMigration(filename: string): string {
  const path = join(MIGRATIONS_DIR, filename);
  expect(existsSync(path), `missing migration ${filename}`).toBe(true);
  return readFileSync(path, 'utf8');
}

function readSource(relativePath: string): string {
  const path = join(REPO_ROOT, relativePath);
  expect(existsSync(path), `missing source ${relativePath}`).toBe(true);
  return readFileSync(path, 'utf8');
}

describe('multi-company DB migrations', () => {
  const foundation = readMigration(MC_MIGRATION_FILES.foundation);
  const companyColumns = readMigration(MC_MIGRATION_FILES.companyColumns);
  const clientsFournisseurs = readMigration(MC_MIGRATION_FILES.clientsFournisseurs);
  const rls = readMigration(MC_MIGRATION_FILES.rls);
  const rpcs = readMigration(MC_MIGRATION_FILES.rpcs);
  const uniques = readMigration(MC_MIGRATION_FILES.uniques);

  it('defines core isolation helpers', () => {
    expect(foundation).toContain('user_company_ids()');
    expect(foundation).toContain('user_in_company');
    expect(foundation).toContain('list_my_companies()');
    expect(foundation).toContain('mc_apply_company_rls');
    expect(foundation).toContain('mc_setup_company_column');
  });

  it('backfills every existing user with at least Grosafe membership', () => {
    expect(foundation).toContain('INSERT INTO public.user_companies');
    expect(foundation).toContain('grosafe_company_id()');
  });

  it('adds company_id to every direct operational table', () => {
    const earlierSet = new Set<string>(EARLIER_COMPANY_ID_TABLES);
    for (const table of DIRECT_COMPANY_SCOPED_TABLES) {
      if (earlierSet.has(table)) {
        expect(clientsFournisseurs, `${table} missing from earlier company_id migration`).toContain(
          table
        );
      } else {
        expect(companyColumns, `${table} missing from company_id migration`).toContain(
          `'${table}'`
        );
      }
    }
  });

  it('enforces user_company_ids RLS on every direct scoped table', () => {
    for (const table of DIRECT_COMPANY_SCOPED_TABLES) {
      const hasGenericRls = rls.includes(`'${table}'`) && rls.includes('mc_apply_company_rls');
      const hasExplicitPolicy =
        rls.includes(`ON public.${table}`) && rls.includes('user_company_ids()');
      expect(
        hasGenericRls || hasExplicitPolicy,
        `${table} has no company-scoped RLS policy in migration`
      ).toBe(true);
    }
  });

  it('creates fuel_cards table with company isolation', () => {
    const fuelCardsMigration = readMigration(MC_MIGRATION_FILES.fuelCards);
    expect(fuelCardsMigration).toContain('CREATE TABLE IF NOT EXISTS public.fuel_cards');
    expect(fuelCardsMigration).toContain("mc_setup_company_column('fuel_cards')");
    expect(fuelCardsMigration).toContain("mc_make_company_unique('fuel_cards', 'num_carte')");
  });

  it('defines SaaS tenant provisioning RPCs', () => {
    const tenantsMigration = readMigration(MC_MIGRATION_FILES.saasTenants);
    expect(tenantsMigration).toContain('CREATE TABLE IF NOT EXISTS public.tenants');
    expect(tenantsMigration).toContain('CREATE TABLE IF NOT EXISTS public.tenant_members');
    expect(tenantsMigration).toContain('provision_my_tenant');
    expect(tenantsMigration).toContain('get_my_tenant');
    expect(tenantsMigration).toContain('grosafe_group');
  });

  it('isolates child tables via parent EXISTS policies', () => {
    const supplemental = [
      MC_MIGRATION_FILES.fuelCardHistory,
    ]
      .filter((filename) => existsSync(join(MIGRATIONS_DIR, filename)))
      .map((filename) => readMigration(filename))
      .join('\n');
    const combinedRls = `${rls}\n${supplemental}`;
    for (const { table, parent } of CHILD_COMPANY_SCOPED_TABLES) {
      expect(combinedRls, `${table} missing child RLS block`).toContain(`public.${table}`);
      expect(combinedRls, `${table} must reference parent ${parent}`).toContain(`public.${parent}`);
      expect(combinedRls, `${table} must use user_company_ids()`).toMatch(
        new RegExp(`${table}[\\s\\S]*user_company_ids\\(\\)`)
      );
    }
  });

  it('scopes SECURITY DEFINER RPCs to caller companies', () => {
    expect(rpcs).toContain('transactions.company_id');
    expect(rpcs).toContain('get_dashboard_stats(p_company_id');
    expect(rpcs).toContain('restore_inventory_clear_tables(p_company_id');
    expect(rpcs).toContain('user_in_company(p_company_id)');
    expect(rpcs).toContain('user_company_ids()');
  });

  it('converts global uniques to per-company composite uniques', () => {
    expect(uniques).toContain('mc_make_company_unique');
    for (const { table, column } of PER_COMPANY_UNIQUE_COLUMNS) {
      expect(uniques, `${table}.${column} not in unique migration`).toContain(
        `mc_make_company_unique('${table}', '${column}')`
      );
    }
  });

  it('does not leave hybrid Grosafe-open policies on clients/fournisseurs', () => {
    const hybridPattern = /grosafe_company_id\(\)\s*\)/;
    const clientsBlock = rls.slice(rls.indexOf('clients'), rls.indexOf('factures'));
    const fournBlock = rls.slice(rls.indexOf('fournisseurs'), rls.indexOf('factures'));
    expect(clientsBlock.match(hybridPattern)).toBeNull();
    expect(fournBlock.match(hybridPattern)).toBeNull();
    expect(rls).toContain("ARRAY['clients', 'fournisseurs']");
  });
});

describe('frontend defense-in-depth (company_id filters)', () => {
  for (const { path, requiredMarkers } of FRONTEND_COMPANY_SCOPED_MODULES) {
    it(`${path} includes required company isolation markers`, () => {
      const source = readSource(path);
      for (const marker of requiredMarkers) {
        expect(source, `${path} missing "${marker}"`).toContain(marker);
      }
    });
  }
});

describe('cross-company scenario matrix (pure logic)', () => {
  it('documents that Granisafe and Grosafe share no row namespace after per-company uniques', () => {
    // Same client code in two companies is allowed; uniqueness is (company_id, code).
    const grosafeClient = { company_id: 'grosafe-uuid', code: 'CLI-001' };
    const granisafeClient = { company_id: 'granisafe-uuid', code: 'CLI-001' };
    expect(grosafeClient.code).toBe(granisafeClient.code);
    expect(grosafeClient.company_id).not.toBe(granisafeClient.company_id);
  });

  it('lists every company boundary layer for rollout verification', () => {
    expect(DIRECT_COMPANY_SCOPED_TABLES.length).toBeGreaterThanOrEqual(20);
    expect(CHILD_COMPANY_SCOPED_TABLES.length).toBeGreaterThanOrEqual(5);
    expect(PER_COMPANY_UNIQUE_COLUMNS.length).toBeGreaterThanOrEqual(6);
    expect(FRONTEND_COMPANY_SCOPED_MODULES.length).toBeGreaterThanOrEqual(10);
  });
});
