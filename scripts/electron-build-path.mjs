/**
 * Electron-builder output lives outside the repo (LocalAppData) to avoid
 * OneDrive / IDE locks on Desktop project folders.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const markerFile = path.join(root, '.electron-build-dir');

function localAppData() {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
}

export function getElectronBuildRoot() {
  return process.env.ELECTRON_BUILD_ROOT || path.join(localAppData(), 'Alpha-electron-build');
}

export function getRunsRoot() {
  return path.join(getElectronBuildRoot(), 'runs');
}

export function writeBuildDirMarker(dir) {
  fs.mkdirSync(path.dirname(markerFile), { recursive: true });
  fs.writeFileSync(markerFile, `${dir}\n`, 'utf8');
}

export function readBuildDirMarker() {
  if (process.env.ELECTRON_BUILD_DIR) {
    return process.env.ELECTRON_BUILD_DIR;
  }
  if (fs.existsSync(markerFile)) {
    const value = fs.readFileSync(markerFile, 'utf8').trim();
    if (value) return value;
  }
  return null;
}

function pruneOldRuns(runsDir, keep = 3) {
  if (!fs.existsSync(runsDir)) return;
  const entries = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      name: d.name,
      path: path.join(runsDir, d.name),
      mtime: fs.statSync(path.join(runsDir, d.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const entry of entries.slice(keep)) {
    try {
      fs.rmSync(entry.path, { recursive: true, force: true });
      console.log(`Pruned old build run: ${entry.name}`);
    } catch {
      // Locked runs are skipped; a future clean can remove them.
    }
  }
}

/** Fresh run directory — avoids needing to delete a locked win-unpacked. */
export function allocateElectronBuildDir() {
  if (process.env.ELECTRON_BUILD_DIR) {
    fs.mkdirSync(process.env.ELECTRON_BUILD_DIR, { recursive: true });
    writeBuildDirMarker(process.env.ELECTRON_BUILD_DIR);
    return process.env.ELECTRON_BUILD_DIR;
  }

  const runsDir = getRunsRoot();
  fs.mkdirSync(runsDir, { recursive: true });

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(runsDir, runId);
  fs.mkdirSync(runDir, { recursive: true });
  writeBuildDirMarker(runDir);
  pruneOldRuns(runsDir, 3);
  return runDir;
}

export function resolveElectronBuildDir() {
  return readBuildDirMarker() || allocateElectronBuildDir();
}

export { root, markerFile };
