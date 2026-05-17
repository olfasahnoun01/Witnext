/**
 * Copies the packaged Alpha app (win-unpacked) into the custom installer's payload folder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcCandidates = [
  path.join(root, '.build-cache', 'win-unpacked'),
  path.join(root, 'release', 'win-unpacked'),
];
const src = srcCandidates.find((p) => fs.existsSync(p));
const dest = path.join(root, 'installer-app', 'resources', 'payload');

if (!src) {
  console.error(
    'Missing win-unpacked. Run first:\n  npm run electron:build:dir'
  );
  process.exit(1);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

fs.cpSync(src, dest, { recursive: true });
console.log(`Payload ready: ${dest}`);
