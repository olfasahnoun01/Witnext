/**
 * Copies electron-builder artifacts from the active build run to release/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveElectronBuildDir, root } from './electron-build-path.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destDir = path.join(root, 'release');
const srcDir = resolveElectronBuildDir();

if (!fs.existsSync(srcDir)) {
  console.warn(`No build output at ${srcDir} — skip copy.`);
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
  console.log(`No matching artifacts in ${srcDir} to copy.`);
} else {
  console.log(`Done (${copied} file(s)).`);
}
