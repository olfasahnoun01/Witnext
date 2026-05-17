const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('alphaInstaller', {
  getDefaults: () => ipcRenderer.invoke('installer:get-defaults'),
  browsePath: () => ipcRenderer.invoke('installer:browse-path'),
  startInstall: (options) => ipcRenderer.invoke('installer:start', options),
  cancelInstall: () => ipcRenderer.invoke('installer:cancel'),
  launchApp: (exePath) => ipcRenderer.invoke('installer:launch', exePath),
  quit: () => ipcRenderer.invoke('installer:quit'),
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('installer:progress', listener);
    return () => ipcRenderer.removeListener('installer:progress', listener);
  },
});
