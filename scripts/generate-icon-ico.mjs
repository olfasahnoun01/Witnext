/**
 * Builds build/icon.ico from square 512px export of witnext-brand-logo-icon.png.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pngPath = path.join(root, 'build', 'branding', 'app-icon-512.png');

if (!fs.existsSync(pngPath)) {
  console.error(`Missing ${pngPath}. Run: npm run assets:branding`);
  process.exit(1);
}

const icoBuffer = await pngToIco(pngPath);
const dest = path.join(root, 'build', 'icon.ico');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, icoBuffer);
console.log(`Wrote ${dest}`);
