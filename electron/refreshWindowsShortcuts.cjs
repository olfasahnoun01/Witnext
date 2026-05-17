const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Refreshes desktop / Start Menu shortcut icons after an update (Windows caches .lnk icons).
 */
function refreshWindowsShortcuts(exePath, productName = 'Alpha') {
  if (process.platform !== 'win32') {
    return Promise.resolve();
  }

  const esc = (s) => s.replace(/'/g, "''");
  const desktopLnk = path.join(process.env.USERPROFILE || '', 'Desktop', `${productName}.lnk`);
  const startMenuLnk = path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    productName,
    `${productName}.lnk`
  );
  const startMenuFlat = path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    `${productName}.lnk`
  );

  const paths = [desktopLnk, startMenuLnk, startMenuFlat].filter((p) => fs.existsSync(p));
  if (paths.length === 0) {
    return Promise.resolve();
  }

  const pathList = paths.map((p) => `'${esc(p)}'`).join(', ');
  const script = `
$exe = '${esc(exePath)}'
$icon = "$exe,0"
$ws = New-Object -ComObject WScript.Shell
foreach ($lnk in @(${pathList})) {
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

module.exports = { refreshWindowsShortcuts };
