const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let server;
let mainWindow;
const singleInstanceLock = app.requestSingleInstanceLock();

function isDev() {
  return !app.isPackaged;
}

function iconPath() {
  const fileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const candidate = path.join(__dirname, '..', 'build', fileName);
  return fs.existsSync(candidate) ? candidate : undefined;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Personal Wealth App',
    icon: iconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.removeMenu();
  loadUrlWithRetry(mainWindow, url);

  mainWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    shell.openExternal(nextUrl);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadUrlWithRetry(win, url, remainingAttempts = 20) {
  win.loadURL(url).catch(() => {
    if (!isDev() || remainingAttempts <= 0 || win.isDestroyed()) return;
    setTimeout(() => loadUrlWithRetry(win, url, remainingAttempts - 1), 500);
  });
}

function startLocalServer() {
  process.env.PERSONAL_WEALTH_DATA_DIR = path.join(app.getPath('userData'), 'data');

  if (!isDev()) {
    process.env.CLIENT_DIST_DIR = path.join(__dirname, '..', 'client', 'dist');
  }

  const { createApp } = isDev() ? require('../server') : require('../dist-server/index.cjs');
  const localApp = createApp();

  return new Promise((resolve) => {
    server = localApp.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    const localUrl = await startLocalServer();
    createWindow(isDev() ? 'http://localhost:5173' : localUrl);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(isDev() ? 'http://localhost:5173' : localUrl);
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
});
