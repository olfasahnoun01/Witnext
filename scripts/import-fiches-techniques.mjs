/**
 * Match local folder `fiches-techniques/<article name>/` files to Supabase `products`,
 * upload to `fiches-techniques` bucket under `fiches/`, set `fiche_technique_url`.
 *
 * Usage:
 *   node scripts/import-fiches-techniques.mjs           # dry-run (default)
 *   node scripts/import-fiches-techniques.mjs --apply # upload + update DB
 *
 * Env (from .env.local or .env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY  (anon: read products if RLS allows; storage usually needs auth)
 *   SUPABASE_SERVICE_ROLE_KEY      (required to read products/groups under RLS + for --apply uploads)
 *
 * Optional: FICHE_MATCH_THRESHOLD=0.72 (default)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FICHES_DIR = path.join(ROOT, 'fiches-techniques');

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

const APPLY = process.argv.includes('--apply');

function norm(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[_/.,;:\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Longest common substring ratio (cheap fuzzy). */
function overlapScore(a, b) {
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.includes(B) || B.includes(A)) return 0.92;
  const shorter = A.length <= B.length ? A : B;
  const longer = A.length > B.length ? A : B;
  let best = 0;
  for (let len = shorter.length; len >= Math.min(10, shorter.length); len--) {
    for (let i = 0; i <= shorter.length - len; i++) {
      const sub = shorter.slice(i, i + len);
      if (longer.includes(sub)) best = Math.max(best, len / longer.length);
    }
  }
  return best;
}

/** Jaccard on word tokens (handles reordering / small typos). */
function wordJaccard(a, b) {
  const words = (s) =>
    new Set(
      norm(s)
        .split(' ')
        .filter((w) => w.length > 1)
    );
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter / uni : 0;
}

function matchScore(folder, candidateName) {
  if (!candidateName) return 0;
  const ex = norm(folder) === norm(candidateName) ? 1 : 0;
  if (ex) return 1;
  return Math.max(overlapScore(folder, candidateName), wordJaccard(folder, candidateName));
}

function bestMatch(folderName, groups, products) {
  const n = norm(folderName);
  let best = { score: 0, type: null, id: null, label: '' };

  for (const g of groups) {
    const s1 = norm(g.name) === n ? 1 : matchScore(folderName, g.name);
    if (s1 > best.score) {
      best = { score: s1, type: 'group', id: g.id, label: g.name };
    }
  }
  for (const p of products) {
    const s2 = norm(p.name) === n ? 1 : matchScore(folderName, p.name);
    if (s2 > best.score) {
      best = { score: s2, type: 'product', id: p.id, label: p.name };
    }
  }
  return best;
}

const MIME = {
  '.pdf': 'application/pdf',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL and key in .env.local');
    process.exit(1);
  }

  if (APPLY && !serviceKey) {
    console.error('--apply requires SUPABASE_SERVICE_ROLE_KEY (storage + products update).');
    process.exit(1);
  }

  const sb = createClient(url, key);

  const { data: groups, error: gErr } = await sb.from('product_groups').select('id,name');
  if (gErr) {
    console.error('product_groups:', gErr.message);
    process.exit(1);
  }
  const { data: products, error: pErr } = await sb
    .from('products')
    .select('id,name,sku,product_group_id,fiche_technique_url');
  if (pErr) {
    console.error('products:', pErr.message);
    process.exit(1);
  }

  console.log('DB: product_groups', (groups || []).length, '| products', (products || []).length);

  if (!fs.existsSync(FICHES_DIR)) {
    console.error('Folder not found:', FICHES_DIR);
    process.exit(1);
  }

  const entries = fs.readdirSync(FICHES_DIR, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory() && e.name !== '_unlinked').map((e) => e.name);

  const matchedProductIds = new Set();
  const plan = [];
  const unmatchedFolders = [];

  for (const folder of folders) {
    const dirPath = path.join(FICHES_DIR, folder);
    const files = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((f) => f.isFile())
      .map((f) => f.name)
      .filter((name) => !name.startsWith('.'))
      .sort();

    if (files.length === 0) continue;

    const m = bestMatch(folder, groups || [], products || []);
    const threshold = Number(process.env.FICHE_MATCH_THRESHOLD) || 0.72;
    if (m.score < threshold) {
      unmatchedFolders.push({ folder, files: files.length, bestScore: m.score, hint: m.label || '—' });
      continue;
    }

    let targetIds = [];
    if (m.type === 'group') {
      targetIds = (products || []).filter((p) => p.product_group_id === m.id).map((p) => p.id);
    } else {
      const sameName = (products || []).filter((p) => p.id === m.id || norm(p.name) === norm(m.label));
      if (sameName.length > 1) {
        targetIds = sameName.map((p) => p.id);
      } else {
        targetIds = [m.id];
      }
    }

    if (targetIds.length === 0) {
      unmatchedFolders.push({ folder, files: files.length, reason: 'no variants for group' });
      continue;
    }

    plan.push({ folder, files, match: m, targetIds });
    targetIds.forEach((id) => matchedProductIds.add(id));
  }

  console.log(APPLY ? 'MODE: APPLY (upload + DB update)\n' : 'MODE: DRY-RUN (no upload)\n');
  console.log('Folders scanned:', folders.length);
  console.log('Matchable folders:', plan.length);
  console.log('Unmatched folders:', unmatchedFolders.length);

  if (!APPLY) {
    for (const row of plan.slice(0, 40)) {
      console.log(
        `  OK  "${row.folder}" → ${row.match.type} "${row.label}" (${row.targetIds.length} product(s)), files: ${row.files.join(', ')}`
      );
    }
    if (plan.length > 40) console.log(`  ... +${plan.length - 40} more`);
  }

  const productsStillMissing = (products || []).filter((p) => {
    const hadFolder = matchedProductIds.has(p.id);
    const empty = !p.fiche_technique_url || String(p.fiche_technique_url).trim() === '';
    return empty && !hadFolder;
  });

  if (APPLY) {
    for (const row of plan) {
      const urls = [];
      for (const fname of row.files) {
        const abs = path.join(FICHES_DIR, row.folder, fname);
        const ext = path.extname(fname).toLowerCase();
        const contentType = MIME[ext] || 'application/octet-stream';
        const buf = fs.readFileSync(abs);
        const storageName = `import_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${fname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = `fiches/${storageName}`;
        const { error: upErr } = await sb.storage.from('fiches-techniques').upload(filePath, buf, {
          upsert: true,
          contentType,
        });
        if (upErr) {
          console.error('Upload failed', row.folder, fname, upErr.message);
          continue;
        }
        const { data: pub } = sb.storage.from('fiches-techniques').getPublicUrl(filePath);
        if (pub?.publicUrl) urls.push(pub.publicUrl);
      }
      if (urls.length === 0) continue;
      const payload = urls.length === 1 ? urls[0] : JSON.stringify(urls);
      for (const pid of row.targetIds) {
        const { error: uErr } = await sb.from('products').update({ fiche_technique_url: payload }).eq('id', pid);
        if (uErr) console.error('Update failed', pid, uErr.message);
        else console.log('Updated product', pid, row.folder);
      }
    }
  }

  const reportPath = path.join(ROOT, 'fiches-techniques-import-report.md');
  const lines = [];
  lines.push('# Rapport import fiches techniques');
  lines.push('');
  lines.push(`- Date: ${new Date().toISOString()}`);
  lines.push(`- Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  lines.push(`- Dossiers appariés: ${plan.length}`);
  lines.push(
    `- Dossiers sans correspondance DB (score < ${Number(process.env.FICHE_MATCH_THRESHOLD) || 0.72}): ${unmatchedFolders.length}`
  );
  lines.push('');

  if ((groups || []).length === 0 && (products || []).length === 0) {
    lines.push('## Base Supabase inaccessible en lecture (0 groupe, 0 produit)');
    lines.push('');
    lines.push(
      'La clé **anon** (`VITE_SUPABASE_PUBLISHABLE_KEY`) ne renvoie aucune ligne : les politiques RLS exigent une session authentifiée (ou la **service role**).'
    );
    lines.push('');
    lines.push('1. Ajoutez dans `.env.local` : `SUPABASE_SERVICE_ROLE_KEY=...` (Dashboard Supabase → Settings → API).');
    lines.push('2. Relancez `node scripts/import-fiches-techniques.mjs` pour prévisualiser les paires dossier ↔ article.');
    lines.push('3. Puis `node scripts/import-fiches-techniques.mjs --apply` pour uploader les fichiers dans le bucket `fiches-techniques` et mettre à jour `products.fiche_technique_url`.');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  let unlinkedCount = 0;
  const unPath = path.join(FICHES_DIR, '_unlinked');
  if (fs.existsSync(unPath)) {
    unlinkedCount = fs.readdirSync(unPath, { withFileTypes: true }).filter((f) => f.isFile()).length;
  }
  lines.push(`## Fichiers dans \`_unlinked\` (non classés par nom d’article) : **${unlinkedCount}**`);
  lines.push('');
  lines.push('## Dossiers locaux (noms = libellés exportés, hors `_unlinked`)');
  lines.push('');
  for (const folder of folders.sort()) {
    const dirPath = path.join(FICHES_DIR, folder);
    const n = fs.readdirSync(dirPath, { withFileTypes: true }).filter((f) => f.isFile()).length;
    lines.push(`- **${folder}** — ${n} fichier(s)`);
  }
  lines.push('');
  lines.push('## Dossiers locaux non appariés (pas de produit / groupe assez proche)');
  lines.push('');
  if (unmatchedFolders.length === 0) {
    lines.push('_(aucun)_');
  } else {
    for (const u of unmatchedFolders) {
      lines.push(`- **${u.folder}** (${u.files} fichier(s))${u.bestScore != null ? ` — meilleur score: ${u.bestScore.toFixed(2)} (${u.hint || ''})` : ''}${u.reason ? ` — ${u.reason}` : ''}`);
    }
  }
  lines.push('');
  lines.push('## Articles (variants) sans fiche — non couverts par un dossier apparié');
  lines.push('');
  if ((products || []).length === 0) {
    lines.push(
      '_Impossible de lister les articles tant que la base n’est pas lisible (voir section « Base Supabase inaccessible » ci-dessus)._'
    );
  } else {
    lines.push(
      `_Produits avec \`fiche_technique_url\` vide et non ciblés par un dossier apparié — **${productsStillMissing.length}** ligne(s)_`
    );
    lines.push('');
    for (const p of productsStillMissing.slice(0, 500)) {
      lines.push(`- id **${p.id}** | SKU \`${p.sku || '—'}\` | **${(p.name || '').replace(/\|/g, ' ')}**`);
    }
    if (productsStillMissing.length > 500) {
      lines.push(`- … et ${productsStillMissing.length - 500} autres`);
    }
  }
  lines.push('');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log('\nReport written:', reportPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
