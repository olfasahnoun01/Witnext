const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const PRODUCT_NAME = 'Witnext';

/** Legacy product / shortcut names from older installers. */
const LEGACY_NAMES = [
  'GroSafe',
  'Grosafe',
  'GroSafe Inventory Hub',
  'Alpha Installer',
  'vite_react_shadcn_ts',
];

function desktopDir() {
  return path.join(process.env.USERPROFILE || '', 'Desktop');
}

function startMenuProgramsDir() {
  return path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs'
  );
}

function currentShortcutPaths(productName = PRODUCT_NAME) {
  const programs = startMenuProgramsDir();
  return [
    path.join(desktopDir(), `${productName}.lnk`),
    path.join(programs, productName, `${productName}.lnk`),
    path.join(programs, `${productName}.lnk`),
  ];
}

function legacyShortcutPaths() {
  const desktop = desktopDir();
  const programs = startMenuProgramsDir();
  const paths = [];

  for (const name of LEGACY_NAMES) {
    paths.push(path.join(desktop, `${name}.lnk`));
    paths.push(path.join(programs, `${name}.lnk`));
    paths.push(path.join(programs, name, `${name}.lnk`));
  }

  return paths;
}

function legacyInstallDirs() {
  const roots = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs'),
    process.env['ProgramFiles'] || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  ];

  const dirs = [];
  for (const root of roots) {
    for (const name of LEGACY_NAMES) {
      dirs.push(path.join(root, name));
    }
  }
  return dirs;
}

function escPs(value) {
  return value.replace(/'/g, "''");
}

function psArray(items) {
  if (items.length === 0) return '@()';
  return `@(${items.map((p) => `'${escPs(p)}'`).join(', ')})`;
}

/**
 * Removes stale shortcuts and old install folders, then refreshes current shortcuts.
 */
function cleanupLegacyInstallAndShortcuts(exePath, productName = PRODUCT_NAME) {
  if (process.platform !== 'win32') {
    return Promise.resolve();
  }

  const currentExe = path.resolve(exePath);
  const currentInstallDir = path.resolve(path.dirname(currentExe));

  const shortcutsToDelete = legacyShortcutPaths().filter((p) => fs.existsSync(p));
  const dirsToDelete = legacyInstallDirs().filter((dir) => {
    if (!fs.existsSync(dir)) return false;
    const resolved = path.resolve(dir);
    return resolved !== currentInstallDir && !currentInstallDir.startsWith(resolved + path.sep);
  });

  const shortcutsToRefresh = currentShortcutPaths(productName).filter((p) =>
    fs.existsSync(p)
  );

  const deleteList = psArray(shortcutsToDelete);
  const dirList = psArray(dirsToDelete);
  const refreshList = psArray(shortcutsToRefresh);

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$exe = '${escPs(currentExe)}'
$icon = "$exe,0"
$ws = New-Object -ComObject WScript.Shell

foreach ($lnk in ${deleteList}) {
  if (Test-Path -LiteralPath $lnk) {
    Remove-Item -LiteralPath $lnk -Force
  }
}

foreach ($dir in ${dirList}) {
  if (Test-Path -LiteralPath $dir) {
    Remove-Item -LiteralPath $dir -Recurse -Force
  }
}

foreach ($lnk in ${refreshList}) {
  $sc = $ws.CreateShortcut($lnk)
  $sc.TargetPath = $exe
  $sc.WorkingDirectory = Split-Path $exe -Parent
  $sc.IconLocation = $icon
  $sc.Save()
}
`;

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
      (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve();
      }
    );
  });
}

/** @deprecated use cleanupLegacyInstallAndShortcuts */
function refreshWindowsShortcuts(exePath, productName = PRODUCT_NAME) {
  return cleanupLegacyInstallAndShortcuts(exePath, productName);
}

module.exports = {
  cleanupLegacyInstallAndShortcuts,
  refreshWindowsShortcuts,
};
