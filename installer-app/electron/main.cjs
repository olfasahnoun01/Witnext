const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const {
  getDefaultInstallDir,
  getPayloadDir,
  runInstallation,
  launchApp,
  PRODUCT_NAME,
} = require('./install/installEngine.cjs');

const isDev = !app.isPackaged;
const DEV_URL = 'http://127.0.0.1:5174';

let mainWindow;
let installCancelled = false;
let installRunning = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 620,
    minWidth: 800,
    minHeight: 560,
    resizable: true,
    frame: false,
    transparent: false,
    backgroundColor: '#070b14',
    show: false,
    icon: path.join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('installer:progress', payload);
  }
}

ipcMain.handle('installer:get-defaults', async () => {
  const pkg = require('../package.json');
  return {
    productName: PRODUCT_NAME,
    defaultInstallPath: getDefaultInstallDir(),
    payloadDir: getPayloadDir(),
    appVersion: pkg.installerPayloadVersion || pkg.version,
    dev: isDev,
  };
});

ipcMain.handle('installer:browse-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose installation folder',
    defaultPath: getDefaultInstallDir(),
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return path.join(result.filePaths[0], PRODUCT_NAME);
});

ipcMain.handle('installer:start', async (_event, options) => {
  if (installRunning) return { ok: false, error: 'Installation already in progress' };
  installRunning = true;
  installCancelled = false;

  try {
    const result = await runInstallation(
      options,
      sendProgress,
      () => installCancelled
    );
    installRunning = false;
    return { ok: true, ...result };
  } catch (err) {
    installRunning = false;
    if (String(err.message) === 'CANCELLED') {
      return { ok: false, cancelled: true };
    }
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('installer:cancel', () => {
  installCancelled = true;
  return { ok: true };
});

ipcMain.handle('installer:launch', (_event, exePath) => {
  if (exePath) launchApp(exePath);
  return { ok: true };
});

ipcMain.handle('installer:quit', () => {
  app.quit();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
