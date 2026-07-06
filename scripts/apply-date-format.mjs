import fs from 'fs';
import path from 'path';

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== 'dist') walk(p, files);
    else if (/\.(tsx?)$/.test(ent.name) && !p.includes('formatAppDate.ts')) files.push(p);
  }
  return files;
}

const importLine =
  "import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';";

const replacements = [
  [/new Date\(`\$\{([^}]+)\}T12:00:00`\)\.toLocaleDateString\('fr-FR'\)/g, 'formatAppDate($1)'],
  [
    /new Date\(`\$\{([^}]+)\.slice\(0, 10\)\}T12:00:00`\)\.toLocaleDateString\('fr-FR'\)/g,
    'formatAppDate($1)',
  ],
  [/new Date\(([^)]+)\)\.toLocaleDateString\('fr-FR'\)/g, 'formatAppDate($1)'],
  [/new Date\(([^)]+)\)\.toLocaleDateString\('fr-TN'[^)]*\)/g, 'formatAppDate($1)'],
  [/new Date\(([^)]+)\)\.toLocaleDateString\(\)/g, 'formatAppDate($1)'],
  [/format\(new Date\(([^)]+)\), 'dd\/MM\/yyyy'(?:, \{ locale: fr \})?\)/g, 'formatAppDate($1)'],
  [
    /format\(parseISO\(([^)]+)\), 'dd\/MM\/yyyy HH:mm'(?:, \{ locale: fr \})?\)/g,
    'formatAppDateTime($1)',
  ],
  [/format\(new Date\(([^)]+)\), 'dd MMM yyyy'(?:, \{ locale: fr \})?\)/g, 'formatAppDate($1)'],
  [/format\(([^,]+), 'dd\/MM\/yyyy'(?:, \{ locale: fr \})?\)/g, 'formatAppDate($1)'],
];

let changed = 0;
for (const file of walk('src')) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  for (const [re, rep] of replacements) src = src.replace(re, rep);
  if (src !== orig) {
    if (!src.includes("from '@/lib/formatAppDate'")) {
      const m = src.match(/^import .+;?\r?\n/m);
      if (m) {
        const idx = src.indexOf(m[0]) + m[0].length;
        src = src.slice(0, idx) + importLine + '\n' + src.slice(idx);
      } else {
        src = importLine + '\n' + src;
      }
    }
    fs.writeFileSync(file, src);
    changed++;
    console.log('updated', file);
  }
}
console.log('total', changed);
