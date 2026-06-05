const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { cleanupLegacyInstallAndShortcuts } = require('./refreshWindowsShortcuts.cjs');

// Stability fix for Windows: prevents window from becoming unresponsive
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Rely on packaging, not NODE_ENV: npm/electron on Windows often runs the main
// process without NODE_ENV=development, which used to load dist/ instead of Vite.
const isDev = !app.isPackaged;

if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// Only one running instance in production (second launch focuses existing window).
const singleInstanceLock = isDev ? true : app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

const devServerUrl = 'http://127.0.0.1:8080';

let mainWindow;

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.focus();
}

/** Same icon as embedded in Alpha.exe (build/icon.ico) for taskbar consistency. */
function getAppIconPath() {
  if (process.platform === 'win32' && app.isPackaged) {
    const resourceIco = path.join(process.resourcesPath, 'icon.ico');
    if (fs.existsSync(resourceIco)) {
      return resourceIco;
    }
    return process.execPath;
  }
  if (app.isPackaged) {
    const distIcon = path.join(__dirname, '../dist/favicon.png');
    if (fs.existsSync(distIcon)) {
      return distIcon;
    }
  }
  return path.join(__dirname, '../public/favicon.png');
}

function createDefaultMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { label: 'Quitter', role: 'quit' }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { label: 'Annuler', role: 'undo' },
        { label: 'Rétablir', role: 'redo' },
        { type: 'separator' },
        { label: 'Couper', role: 'cut' },
        { label: 'Copier', role: 'copy' },
        { label: 'Coller', role: 'paste' },
        { label: 'Supprimer', role: 'delete' },
        { type: 'separator' },
        { label: 'Tout sélectionner', role: 'selectAll' }
      ]
    },
    {
      label: 'Affichage',
      submenu: isDev
        ? [
            { label: 'Actualiser', role: 'reload' },
            { label: 'Actualiser (forcé)', role: 'forceReload' },
            { label: 'Outils de développement', role: 'toggleDevTools' },
            { type: 'separator' },
            { label: 'Plein écran', role: 'togglefullscreen' }
          ]
        : [{ label: 'Plein écran', role: 'togglefullscreen' }]
    },
    {
      label: 'Fenêtre',
      submenu: [
        { label: 'Réduire', role: 'minimize' },
        { label: 'Fermer', role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    title: "Alpha",
    icon: getAppIconPath(),
  });

  createDefaultMenu();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file://') || url.startsWith('blob:') || url.startsWith('about:')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev) return;
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
    mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
      console.error('[electron] did-fail-load', { code, desc, url });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Force focus when window is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.focus();
  });
}

function parseVersionParts(version) {
  return String(version || '')
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .map((part) => parseInt(part, 10) || 0);
}

function isGroupedUpdate(currentVersion, newVersion) {
  const current = parseVersionParts(currentVersion);
  const next = parseVersionParts(newVersion);
  if (current.length < 2 || next.length < 2) {
    return currentVersion !== newVersion;
  }
  if (next[0] !== current[0]) return true;
  if (next[1] !== current[1]) return true;
  if (next.length > 2 && current.length > 2 && next[2] - current[2] > 1) return true;
  return false;
}

function resolveUpdateFileSize(info) {
  const files = Array.isArray(info?.files) ? info.files : [];
  const preferred =
    files.find((file) => file.url && String(file.url).endsWith('.exe')) ||
    files.find((file) => typeof file.size === 'number' && file.size > 0) ||
    files[0];
  return typeof preferred?.size === 'number' && preferred.size > 0 ? preferred.size : null;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

/** Latest pending update metadata (always jumps to newest release in one download). */
let pendingUpdateMeta = null;

// Always fetch the newest installer from latest.yml (one grouped download).
autoUpdater.autoDownload = true;
autoUpdater.allowDowngrade = false;
// Full installer: predictable size when users skipped several releases.
autoUpdater.disableDifferentialDownload = true;

// Auto-update logging and events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  const currentVersion = app.getVersion();
  const newVersion = info.version || 'inconnue';
  const totalBytes = resolveUpdateFileSize(info);
  const grouped = isGroupedUpdate(currentVersion, newVersion);

  pendingUpdateMeta = { currentVersion, newVersion, totalBytes, grouped };

  sendToRenderer('update-info', pendingUpdateMeta);

  const sizeLabel = totalBytes ? formatBytesForLog(totalBytes) : 'taille inconnue';
  const jumpLabel = grouped
    ? `Mise à jour groupée ${currentVersion} → ${newVersion}`
    : `Mise à jour ${currentVersion} → ${newVersion}`;

  sendToRenderer(
    'update-message',
    `${jumpLabel}. Téléchargement (${sizeLabel})…`
  );
});

function formatBytesForLog(bytes) {
  if (!bytes || bytes <= 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const digits = i === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[i]}`;
}

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
  pendingUpdateMeta = null;
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
  pendingUpdateMeta = null;
  sendToRenderer('update-progress', null);
});

autoUpdater.on('download-progress', (progressObj) => {
  const total =
    progressObj.total > 0
      ? progressObj.total
      : pendingUpdateMeta?.totalBytes || 0;

  const percent =
    total > 0
      ? Math.min(100, (progressObj.transferred / total) * 100)
      : progressObj.percent;

  const log_message =
    `Download speed: ${progressObj.bytesPerSecond} B/s - ${percent.toFixed(1)}%` +
    ` (${progressObj.transferred}/${total || '?'})`;
  console.log(log_message);

  sendToRenderer('update-progress', {
    percent,
    transferred: progressObj.transferred,
    total,
    bytesPerSecond: progressObj.bytesPerSecond,
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(percent / 100);
  }
});

autoUpdater.on('update-downloaded', async (info) => {
  console.log('Update downloaded:', info);
  sendToRenderer('update-progress', null);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(-1);
  }

  try {
    await cleanupLegacyInstallAndShortcuts(app.getPath('exe'));
  } catch (err) {
    console.warn('Legacy install/shortcut cleanup failed (non-fatal):', err);
  }

  const fromVersion = pendingUpdateMeta?.currentVersion || app.getVersion();
  const toVersion = info.version || pendingUpdateMeta?.newVersion || 'nouvelle version';
  const grouped = pendingUpdateMeta?.grouped;

  const dialogOpts = {
    type: 'info',
    buttons: ['Redémarrer', 'Plus tard'],
    title: grouped ? 'Mise à jour groupée prête' : 'Mise à jour prête',
    message: `La version ${toVersion} a été téléchargée.`,
    detail: grouped
      ? `Toutes les mises à jour depuis la version ${fromVersion} sont regroupées dans ce téléchargement.\n\nRedémarrer maintenant pour installer ?`
      : `Redémarrer l'application pour passer de ${fromVersion} à ${toVersion} ?`,
  };

  dialog.showMessageBox(mainWindow, dialogOpts).then((returnValue) => {
    // Windows: native message boxes can leave the BrowserWindow without keyboard focus;
    // restoring focus fixes "cannot type until app restart" for the web UI.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.focus();
    }
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

if (!isDev) {
  app.on('second-instance', () => {
    focusMainWindow();
  });
}

if (singleInstanceLock) {
  app.whenReady().then(async () => {
    if (!isDev) {
      try {
        await cleanupLegacyInstallAndShortcuts(app.getPath('exe'));
      } catch (err) {
        console.warn('Startup legacy cleanup failed (non-fatal):', err);
      }
    }

    createWindow();

    // Check for updates (custom in-app UI; no OS notification)
    if (!isDev) {
      autoUpdater.checkForUpdates();
    }

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
}
