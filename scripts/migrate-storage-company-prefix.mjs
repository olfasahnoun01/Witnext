/**
 * Copy legacy flat storage paths to `{companyId}/…` for company-scoped RLS.
 *
 * Usage:
 *   node scripts/migrate-storage-company-prefix.mjs                         # dry-run (defaults to grosafe)
 *   node scripts/migrate-storage-company-prefix.mjs --apply                   # copy objects
 *   node scripts/migrate-storage-company-prefix.mjs --company grosafe       # shorthand (see scripts/company-ids.json)
 *   node scripts/migrate-storage-company-prefix.mjs --company-id <uuid>     # explicit UUID
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
const COMPANY_IDS_PATH = path.join(__dirname, 'company-ids.json');

const BUCKETS = [
  'client-documents',
  'fiches-techniques',
  'gallery-photos',
  'hr-contracts',
  'rh-report-files',
  'commercial-attachments',
];

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i;
const COMPANY_CODE_ALIASES = {
  grosafe: 'grosafe',
  granisafe: 'granisafe',
  safe_team: 'safe_team',
  safeteam: 'safe_team',
  'safe-team': 'safe_team',
};

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

function loadKnownCompanyIds() {
  if (!fs.existsSync(COMPANY_IDS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(COMPANY_IDS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

loadEnvFile('.env.local');
loadEnvFile('.env');
loadEnvFile('supabase/.env.local');
loadEnvFile('supabase/.env');

const APPLY = process.argv.includes('--apply');
const CLI_COMPANY_ID = argValue('--company-id');
const CLI_COMPANY_CODE = argValue('--company');
const KNOWN_COMPANY_IDS = loadKnownCompanyIds();

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error('Storage migration requires credentials in `.env.local` (or `supabase/.env.local`).\n');
  if (!url) console.error('  Missing VITE_SUPABASE_URL');
  if (!serviceKey) {
    console.error('  Missing SUPABASE_SERVICE_ROLE_KEY');
    console.error('    → Supabase Dashboard → Project Settings → API → service_role');
  }
  console.error('\nSee .env.example for the full template.');
  process.exit(1);
}

function resolveDefaultCompanyIdFromCli() {
  if (CLI_COMPANY_ID) return CLI_COMPANY_ID.trim();
  if (CLI_COMPANY_CODE) {
    const code = COMPANY_CODE_ALIASES[CLI_COMPANY_CODE.toLowerCase().replace(/\s+/g, '_')];
    if (!code) {
      console.error(`Unknown --company "${CLI_COMPANY_CODE}". Use: grosafe, granisafe, safe_team`);
      process.exit(1);
    }
    const id = KNOWN_COMPANY_IDS[code];
    if (!id) {
      console.error(`No UUID for "${code}" in scripts/company-ids.json`);
      process.exit(1);
    }
    return id;
  }
  return KNOWN_COMPANY_IDS.grosafe ?? null;
}

console.log(`Connecting to ${url.replace(/^https?:\/\//, '').split(/\/.*$/, '')}…`);

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function listAllObjects(bucket, prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit, offset });
    if (error) throw new Error(`[${bucket}] list ${prefix || '/'}: ${error.message}`);
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

function normCode(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function loadCompanyMaps() {
  const { data: companies, error: cErr } = await supabase.from('companies').select('id, code, name');
  if (cErr) throw new Error(cErr.message);

  const byId = new Map();
  const byCode = new Map();
  for (const c of companies || []) {
    byId.set(c.id, c);
    byCode.set(c.code, c.id);
  }

  const defaultCompanyId =
    resolveDefaultCompanyIdFromCli() ||
    (companies?.length === 1 ? companies[0].id : KNOWN_COMPANY_IDS.grosafe ?? null);

  const employeeCompany = new Map();
  const { data: employees } = await supabase.from('hr_employees').select('id, company_id');
  for (const e of employees || []) {
    if (e.id && e.company_id) employeeCompany.set(e.id, e.company_id);
  }

  const entityCompany = new Map();
  const [{ data: clients }, { data: fournisseurs }] = await Promise.all([
    supabase.from('clients').select('code, company_id'),
    supabase.from('fournisseurs').select('code, company_id'),
  ]);
  for (const row of clients || []) {
    if (row.code && row.company_id) entityCompany.set(normCode(row.code), row.company_id);
  }
  for (const row of fournisseurs || []) {
    if (row.code && row.company_id) entityCompany.set(normCode(row.code), row.company_id);
  }

  return {
    companies: companies || [],
    byId,
    byCode,
    defaultCompanyId,
    employeeCompany,
    entityCompany,
  };
}

function companyLabel(maps, id) {
  const row = maps.byId.get(id);
  return row ? `${row.name} (${row.code})` : id;
}

function resolveFromClientDocumentPath(objectPath, maps) {
  const base = objectPath.split('/').pop() || objectPath;
  const match = base.match(/^(?:patente|rc)_(.+)\.[^.]+$/i);
  if (!match) return null;
  return maps.entityCompany.get(normCode(match[1])) ?? null;
}

function resolveTargetCompany(bucket, objectPath, maps) {
  if (bucket === 'hr-contracts') {
    const first = objectPath.split('/')[0];
    if (maps.employeeCompany.has(first)) return maps.employeeCompany.get(first);
    if (UUID_PREFIX.test(`${first}/`)) return first;
  }
  if (bucket === 'client-documents') {
    const fromEntity = resolveFromClientDocumentPath(objectPath, maps);
    if (fromEntity) return fromEntity;
  }
  return maps.defaultCompanyId;
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
    const label = companyLabel(maps, companyId);
    console.log(`[${bucket}] ${oldPath} -> ${newPath}  (${label})`);
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

  console.log('Companies in database:');
  for (const c of maps.companies) {
    console.log(`  ${c.code.padEnd(12)} ${c.id}  ${c.name}`);
  }

  if (!maps.defaultCompanyId) {
    console.error('\nNo default company. Pass --company grosafe|granisafe|safe_team or --company-id <uuid>.');
    process.exit(1);
  }

  console.log(`\nDefault company for unmappable paths: ${companyLabel(maps, maps.defaultCompanyId)}`);
  console.log(APPLY ? 'APPLY mode\n' : 'DRY-RUN mode\n');

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

  console.log(`\nDone. migrated=${totalMigrated} skipped=${totalSkipped}`);
  if (!APPLY && totalMigrated > 0) {
    console.log('Re-run with --apply to copy objects.');
    console.log('Per-company override: --company granisafe | --company safe_team');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
