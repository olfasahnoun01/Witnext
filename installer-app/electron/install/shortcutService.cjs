const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      }
    );
  });
}

/**
 * Creates a .lnk shortcut (desktop and/or Start Menu).
 */
async function createShortcut({ targetPath, workingDir, shortcutPath, description }) {
  const esc = (s) => s.replace(/'/g, "''");
  const script = `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('${esc(shortcutPath)}')
$sc.TargetPath = '${esc(targetPath)}'
$sc.WorkingDirectory = '${esc(workingDir)}'
$sc.Description = '${esc(description)}'
$sc.Save()
`;
  await runPowerShell(script);
}

async function createWindowsShortcuts({ installDir, appExeName, productName, desktop, startMenu }) {
  const exePath = path.join(installDir, appExeName);
  if (!fs.existsSync(exePath)) {
    throw new Error(`Executable not found: ${exePath}`);
  }

  if (desktop) {
    const desktopDir = path.join(process.env.USERPROFILE, 'Desktop');
    await createShortcut({
      targetPath: exePath,
      workingDir: installDir,
      shortcutPath: path.join(desktopDir, `${productName}.lnk`),
      description: productName,
    });
  }

  if (startMenu) {
    const programsDir = path.join(
      process.env.APPDATA,
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      productName
    );
    fs.mkdirSync(programsDir, { recursive: true });
    await createShortcut({
      targetPath: exePath,
      workingDir: installDir,
      shortcutPath: path.join(programsDir, `${productName}.lnk`),
      description: productName,
    });
  }
}

module.exports = { createWindowsShortcuts };
