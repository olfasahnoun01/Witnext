/**
 * Cross-platform Witnext branding: favicon + Electron .ico from witnext-brand-logo-icon.png
 * (Works on Vercel/Linux — no PowerShell required.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const master = path.join(root, 'src', 'assets', 'witnext-brand-logo-icon.png');
const brandingDir = path.join(root, 'build', 'branding');
const faviconPath = path.join(root, 'public', 'favicon.png');
const square512Path = path.join(brandingDir, 'app-icon-512.png');
const icoPath = path.join(root, 'build', 'icon.ico');

async function removeNearWhitePng(inputBuffer, threshold = 242) {
  const { data, info } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();
}

async function main() {
  if (!fs.existsSync(master)) {
    throw new Error(`Missing master logo: ${master}`);
  }

  fs.mkdirSync(brandingDir, { recursive: true });
  fs.mkdirSync(path.dirname(icoPath), { recursive: true });

  const input = fs.readFileSync(master);
  const transparent = await removeNearWhitePng(input);

  const squarePng = await transparent
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  fs.writeFileSync(square512Path, squarePng);
  fs.writeFileSync(faviconPath, squarePng);
  console.log(`Updated ${faviconPath}`);

  const icoBuffer = await pngToIco(square512Path);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`Wrote ${icoPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
