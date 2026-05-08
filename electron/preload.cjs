const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateMessage: (callback) => ipcRenderer.on('update-message', (_event, value) => callback(value)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, value) => callback(value))
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
