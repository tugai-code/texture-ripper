const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs/promises');
const path = require('node:path');

const isMac = process.platform === 'darwin';
const releasesURL = 'https://github.com/tugai-code/texture-ripper/releases/latest';
const imageTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp'
};

let mainWindow;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.maximize();
  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (app.isPackaged && !isMac) {
    mainWindow.webContents.once('did-finish-load', () => {
      autoUpdater.checkForUpdatesAndNotify();
    });
  }
}

function createApplicationMenu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Images…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer('open-images')
        },
        {
          label: 'Export Atlas…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer('export-atlas')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToRenderer('undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendToRenderer('redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Download Latest Release',
          click: () => shell.openExternal(releasesURL)
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;
autoUpdater.fullChangelog = true;
autoUpdater.logger = console;

autoUpdater.on('checking-for-update', () => {
  sendToRenderer('update-status', 'Checking for updates…');
});
autoUpdater.on('update-available', (info) => {
  sendToRenderer('update-available', info);
});
autoUpdater.on('update-not-available', (info) => {
  sendToRenderer('update-not-available', info);
});
autoUpdater.on('update-downloaded', (info) => {
  sendToRenderer('update-downloaded', info);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Update downloaded. Application will restart to install version ${info.version}.`,
    buttons: ['Restart Now', 'Later']
  }).then(result => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});
autoUpdater.on('download-progress', (progress) => {
  sendToRenderer('download-progress', progress);
});
autoUpdater.on('error', (error) => {
  console.error('Update error:', error);
  sendToRenderer('update-error', error.toString());
});

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  autoUpdates: app.isPackaged && !isMac
}));

ipcMain.handle('open-images', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(window, {
    title: 'Open Images',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: Object.keys(imageTypes).map(ext => ext.slice(1)) }]
  });

  if (result.canceled) return [];

  return Promise.all(result.filePaths.map(async filePath => {
    const data = await fs.readFile(filePath);
    return {
      name: path.basename(filePath),
      dataURL: `data:${imageTypes[path.extname(filePath).toLowerCase()]};base64,${data.toString('base64')}`
    };
  }));
});

ipcMain.handle('save-png', async (event, dataURL) => {
  if (typeof dataURL !== 'string' || !dataURL.startsWith('data:image/png;base64,')) {
    throw new Error('Invalid PNG data');
  }

  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(window, {
    title: 'Export Atlas',
    defaultPath: 'atlas.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });

  if (result.canceled || !result.filePath) return false;

  const base64 = dataURL.slice('data:image/png;base64,'.length);
  await fs.writeFile(result.filePath, Buffer.from(base64, 'base64'));
  return true;
});

ipcMain.handle('check-for-updates', async () => {
  if (isMac) {
    await shell.openExternal(releasesURL);
    return { external: true };
  }
  if (!app.isPackaged) return { disabled: true };
  await autoUpdater.checkForUpdates();
  return { checking: true };
});

ipcMain.handle('restart-and-install', () => {
  if (app.isPackaged && !isMac) autoUpdater.quitAndInstall();
});

ipcMain.handle('open-external', (_event, value) => {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Unsupported URL protocol');
  }
  return shell.openExternal(url.toString());
});

app.whenReady().then(() => {
  createApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
