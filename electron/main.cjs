const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Stability fix for Windows: prevents window from becoming unresponsive
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Rely on packaging, not NODE_ENV: npm/electron on Windows often runs the main
// process without NODE_ENV=development, which used to load dist/ instead of Vite.
const isDev = !app.isPackaged;

if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

const devServerUrl = 'http://127.0.0.1:8080';

let mainWindow;

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
      submenu: [
        { label: 'Actualiser', role: 'reload' },
        { label: 'Actualiser (forcé)', role: 'forceReload' },
        { label: 'Outils de développement', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Plein écran', role: 'togglefullscreen' }
      ]
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
      preload: path.join(__dirname, 'preload.cjs')
    },
    title: "Alpha",
    icon: path.join(__dirname, '../public/favicon.png')
  });

  createDefaultMenu();

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

// Auto-update logging and events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-message', 'Une mise à jour est disponible. Téléchargement en cours...');
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
    mainWindow.setProgressBar(progressObj.percent / 100);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-progress', null);
    mainWindow.setProgressBar(-1);
  }
  
  const dialogOpts = {
    type: 'info',
    buttons: ['Redémarrer', 'Plus tard'],
    title: 'Mise à jour disponible',
    message: 'Une nouvelle version de l\'application a été téléchargée.',
    detail: 'Voulez-vous redémarrer l\'application pour appliquer les mises à jour maintenant ?'
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

app.whenReady().then(() => {
  createWindow();

  // Check for updates
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
