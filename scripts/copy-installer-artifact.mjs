/**
 * Copies Installer.exe from the isolated installer build output to release/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, '.build-cache', 'installer', 'Installer.exe');
const destDir = path.join(root, 'release');
const dest = path.join(destDir, 'Installer.exe');

if (!fs.existsSync(src)) {
  console.error(`Missing ${src}. Run electron-builder with electron-builder.installer.json first.`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Installer ready: ${dest}`);
