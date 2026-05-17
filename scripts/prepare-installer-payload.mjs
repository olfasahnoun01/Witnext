/**
 * Copies the packaged Alpha app (win-unpacked) into the custom installer's payload folder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'release', 'win-unpacked');
const dest = path.join(root, 'installer-app', 'resources', 'payload');

if (!fs.existsSync(src)) {
  console.error(
    'Missing release/win-unpacked. Run first:\n  npm run build\n  npx electron-builder --config electron-builder.dir.json --win'
  );
  process.exit(1);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

fs.cpSync(src, dest, { recursive: true });
console.log(`Payload ready: ${dest}`);
