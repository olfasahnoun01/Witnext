/**
 * Copy legacy flat storage paths to `{companyId}/…` for company-scoped RLS.
 *
 * Usage:
 *   node scripts/migrate-storage-company-prefix.mjs                    # dry-run
 *   node scripts/migrate-storage-company-prefix.mjs --apply            # copy objects
 *   node scripts/migrate-storage-company-prefix.mjs --company-id <uuid> # default company
 *
 * Env (.env.local / .env):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const BUCKETS = [
  'client-documents',
  'fiches-techniques',
  'gallery-photos',
  'hr-contracts',
  'rh-report-files',
  'commercial-attachments',
];

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i;

function loadEnvFile(name) {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');
loadEnvFile('supabase/.env.local');
loadEnvFile('supabase/.env');

const APPLY = process.argv.includes('--apply');
const companyArgIdx = process.argv.indexOf('--company-id');
const CLI_COMPANY_ID = companyArgIdx >= 0 ? process.argv[companyArgIdx + 1] : null;

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error('Storage migration requires credentials in `.env.local` (or `supabase/.env.local`).\n');
  if (!url) {
    console.error('  Missing VITE_SUPABASE_URL');
  }
  if (!serviceKey) {
    console.error('  Missing SUPABASE_SERVICE_ROLE_KEY');
    console.error('    → Supabase Dashboard → Project Settings → API → service_role');
    console.error('    → Add to .env.local (never commit this file):');
    console.error('      SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  }
  console.error('\nSee .env.example for the full template.');
  process.exit(1);
}

console.log(`Connecting to ${url.replace(/^https?:\/\//, '').split(/\/.*$/, '')}…`);

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function listAllObjects(bucket, prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit, offset });
    if (error) throw new Error(`[${bucket}] list ${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id == null) {
        out.push(...(await listAllObjects(bucket, fullPath)));
      } else {
        out.push(fullPath);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function loadCompanyMaps() {
  const { data: companies, error: cErr } = await supabase.from('companies').select('id');
  if (cErr) throw new Error(cErr.message);
  const companyIds = (companies || []).map((c) => c.id);
  const defaultCompanyId =
    CLI_COMPANY_ID ||
    (companyIds.length === 1 ? companyIds[0] : null);

  const employeeCompany = new Map();
  const { data: employees } = await supabase.from('hr_employees').select('id, company_id');
  for (const e of employees || []) {
    if (e.id && e.company_id) employeeCompany.set(e.id, e.company_id);
  }

  const reportCompany = new Map();
  const { data: reports } = await supabase.from('rh_security_reports').select('id, company_name');
  void reports;

  return { companyIds, defaultCompanyId, employeeCompany, reportCompany };
}

function resolveTargetCompany(bucket, objectPath, maps) {
  const { defaultCompanyId, employeeCompany } = maps;
  if (bucket === 'hr-contracts') {
    const employeeId = objectPath.split('/')[0];
    if (employeeCompany.has(employeeId)) return employeeCompany.get(employeeId);
  }
  if (bucket === 'rh-report-files') {
    const reportId = objectPath.split('/')[0];
    if (maps.reportCompany?.has(reportId)) return maps.reportCompany.get(reportId);
  }
  return defaultCompanyId;
}

async function migrateBucket(bucket, maps) {
  process.stdout.write(`[${bucket}] listing… `);
  const paths = await listAllObjects(bucket);
  console.log(`${paths.length} object(s)`);
  const legacy = paths.filter((p) => !UUID_PREFIX.test(p));
  if (!legacy.length) {
    console.log(`[${bucket}] no legacy paths`);
    return { bucket, migrated: 0, skipped: 0 };
  }

  let migrated = 0;
  let skipped = 0;

  for (const oldPath of legacy) {
    const companyId = resolveTargetCompany(bucket, oldPath, maps);
    if (!companyId) {
      console.warn(`[${bucket}] skip (no company): ${oldPath}`);
      skipped++;
      continue;
    }
    const newPath = `${companyId}/${oldPath}`;
    if (paths.includes(newPath)) {
      console.log(`[${bucket}] already exists: ${newPath}`);
      skipped++;
      continue;
    }
    console.log(`[${bucket}] ${oldPath} -> ${newPath}`);
    if (APPLY) {
      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(oldPath);
      if (dlErr) {
        console.error(`  download failed: ${dlErr.message}`);
        skipped++;
        continue;
      }
      const { error: upErr } = await supabase.storage.from(bucket).upload(newPath, blob, { upsert: true });
      if (upErr) {
        console.error(`  upload failed: ${upErr.message}`);
        skipped++;
        continue;
      }
    }
    migrated++;
  }

  return { bucket, migrated, skipped };
}

async function main() {
  const maps = await loadCompanyMaps();
  if (!maps.defaultCompanyId && maps.companyIds.length !== 1) {
    console.warn(
      'Multiple companies found; pass --company-id <uuid> for paths that cannot be inferred from hr_employees.'
    );
  }

  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN mode');
  let totalMigrated = 0;
  let totalSkipped = 0;

  for (const bucket of BUCKETS) {
    try {
      const { migrated, skipped } = await migrateBucket(bucket, maps);
      totalMigrated += migrated;
      totalSkipped += skipped;
    } catch (e) {
      console.error(`[${bucket}] ${e.message}`);
    }
  }

  console.log(`Done. migrated=${totalMigrated} skipped=${totalSkipped}`);
  if (!APPLY && totalMigrated > 0) {
    console.log('Re-run with --apply to copy objects.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
