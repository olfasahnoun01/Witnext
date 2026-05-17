/**
 * Copies NSIS / publish artifacts from .build-cache to release/ for local convenience.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, '.build-cache');
const destDir = path.join(root, 'release');

if (!fs.existsSync(srcDir)) {
  console.warn('No .build-cache folder — skip copy.');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });

const patterns = [
  /^Alpha-Setup-.*\.exe$/i,
  /^Alpha Setup .*\.exe$/i,
  /\.blockmap$/i,
  /^latest\.yml$/i,
  /^builder-effective-config\.yaml$/i,
];

let copied = 0;
for (const name of fs.readdirSync(srcDir)) {
  if (!patterns.some((re) => re.test(name))) continue;
  const src = path.join(srcDir, name);
  const dest = path.join(destDir, name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, dest);
  console.log(`Copied ${name} → release/`);
  copied += 1;
}

if (copied === 0) {
  console.log('No matching artifacts in .build-cache to copy.');
} else {
  console.log(`Done (${copied} file(s)).`);
}
