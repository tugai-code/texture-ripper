const { contextBridge, ipcRenderer } = require('electron');

const events = new Set([
  'open-images',
  'export-atlas',
  'undo',
  'redo',
  'update-status',
  'update-available',
  'update-not-available',
  'update-downloaded',
  'download-progress',
  'update-error'
]);

contextBridge.exposeInMainWorld('textureRipper', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  openImages: () => ipcRenderer.invoke('open-images'),
  savePNG: dataURL => ipcRenderer.invoke('save-png', dataURL),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartAndInstall: () => ipcRenderer.invoke('restart-and-install'),
  openExternal: url => ipcRenderer.invoke('open-external', url),
  on: (channel, callback) => {
    if (!events.has(channel)) return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
