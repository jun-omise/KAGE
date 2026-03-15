const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.env.npm_package_version || '0.1.0',
  isElectron: true,
  onNavigate: (callback) => ipcRenderer.on('navigate', (_, path) => callback(path)),
});
