/**
 * Builds multi-size build/icon.ico from the same PNG used in the app UI (logo-icon-512).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pngPath = path.join(root, 'src', 'assets', 'logo-icon-512.png');

if (!fs.existsSync(pngPath)) {
  console.error(
    `Missing ${pngPath}. Run: npm run installer:assets`
  );
  process.exit(1);
}

const icoBuffer = await pngToIco(pngPath);
const targets = [
  path.join(root, 'build', 'icon.ico'),
  path.join(root, 'build', 'installer', 'icon.ico'),
];

for (const dest of targets) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, icoBuffer);
  console.log(`Wrote ${dest}`);
}
