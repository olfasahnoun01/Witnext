const fs = require('fs');
const path = require('path');
const { STAGES, getStageLabel } = require('./progressStages.cjs');
const { createWindowsShortcuts } = require('./shortcutService.cjs');

const PRODUCT_NAME = 'Alpha';
const APP_EXE = 'Alpha.exe';

function getPayloadDir() {
  if (process.env.ALPHA_INSTALLER_PAYLOAD) {
    return process.env.ALPHA_INSTALLER_PAYLOAD;
  }
  return path.join(process.resourcesPath, 'payload');
}

function getDefaultInstallDir() {
  return path.join(process.env.LOCALAPPDATA || '', 'Programs', PRODUCT_NAME);
}

async function pathExists(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

function emit(sendProgress, payload) {
  if (typeof sendProgress === 'function') {
    sendProgress({
      ...payload,
      statusLabel: payload.statusLabel ?? getStageLabel(payload.stage),
    });
  }
}

async function copyWithProgress(src, dest, sendProgress, cancelled) {
  const totalStages = STAGES.reduce((a, s) => a + s.weight, 0);
  let stageBase = STAGES[0].weight;

  emit(sendProgress, { stage: 'preparing', percent: 2, statusLabel: 'Preparing files' });
  if (cancelled()) throw new Error('CANCELLED');

  await fs.promises.mkdir(dest, { recursive: true });

  const entries = await collectFiles(src);
  const totalBytes = entries.reduce((n, e) => n + e.size, 0);
  let copiedBytes = 0;

  emit(sendProgress, { stage: 'extracting', percent: 10, statusLabel: 'Extracting packages' });
  if (cancelled()) throw new Error('CANCELLED');

  for (const entry of entries) {
    if (cancelled()) throw new Error('CANCELLED');
    const rel = path.relative(src, entry.fullPath);
    const target = path.join(dest, rel);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.copyFile(entry.fullPath, target);
    copiedBytes += entry.size;
    const extractWeight = STAGES.find((s) => s.id === 'extracting').weight;
    const prepWeight = STAGES.find((s) => s.id === 'preparing').weight;
    const ratio = totalBytes > 0 ? copiedBytes / totalBytes : 1;
    const percent = prepWeight + ratio * extractWeight;
    emit(sendProgress, {
      stage: 'extracting',
      percent: Math.min(percent / totalStages * 100, 78),
      statusLabel: 'Extracting packages',
      detail: rel,
    });
  }

  return { totalStages };
}

async function collectFiles(root) {
  const out = [];
  async function walk(dir) {
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) await walk(fullPath);
      else {
        const stat = await fs.promises.stat(fullPath);
        out.push({ fullPath, size: stat.size });
      }
    }
  }
  await walk(root);
  return out;
}

async function writeInstallMetadata(installDir, options) {
  const meta = {
    productName: PRODUCT_NAME,
    version: options.appVersion ?? '0.0.0',
    installedAt: new Date().toISOString(),
    installDir,
  };
  await fs.promises.writeFile(
    path.join(installDir, '.alpha-install.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );
}

/**
 * Runs the full install workflow (copy payload, shortcuts, finalize).
 */
async function runInstallation(options, sendProgress, isCancelled) {
  const cancelled = () => isCancelled();
  const payloadDir = getPayloadDir();
  const installDir = options.installPath || getDefaultInstallDir();

  if (!(await pathExists(payloadDir))) {
    throw new Error(
      `Application package not found at ${payloadDir}. Rebuild with: npm run electron:build:installer`
    );
  }

  emit(sendProgress, { stage: 'preparing', percent: 5, statusLabel: 'Preparing files' });
  if (cancelled()) throw new Error('CANCELLED');

  await copyWithProgress(payloadDir, installDir, sendProgress, cancelled);

  emit(sendProgress, { stage: 'components', percent: 82, statusLabel: 'Installing components' });
  if (cancelled()) throw new Error('CANCELLED');

  await createWindowsShortcuts({
    installDir,
    appExeName: APP_EXE,
    productName: PRODUCT_NAME,
    desktop: options.desktopShortcut !== false,
    startMenu: options.startMenuShortcut !== false,
  });

  emit(sendProgress, { stage: 'finalizing', percent: 92, statusLabel: 'Finalizing installation' });
  await writeInstallMetadata(installDir, options);

  emit(sendProgress, { stage: 'finalizing', percent: 100, statusLabel: 'Finalizing installation', done: true });

  return { installDir, exePath: path.join(installDir, APP_EXE) };
}

function launchApp(exePath) {
  const { spawn } = require('child_process');
  spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
}

module.exports = {
  APP_EXE,
  PRODUCT_NAME,
  getPayloadDir,
  getDefaultInstallDir,
  runInstallation,
  launchApp,
};
