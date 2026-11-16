const { app, BrowserWindow, ipcMain, Menu, screen, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { userInfo } = require('node:os');

const page = path.join(__dirname, 'ui', 'index.html');
const pageURL = pathToFileURL(page).href;
let win;
app.setName('CoCo');
app.setAppUserModelId('org.coco.desktop.windows');

function isWindow(event) {
  return win && event.sender === win.webContents && event.senderFrame?.url === pageURL;
}

function openWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    title: 'CoCo', icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    width: Math.min(1280, width), height: Math.min(800, height),
    minWidth: 600, minHeight: 440, frame: false, show: false,
    backgroundColor: '#F2F2F4', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.on('maximize', () => win.webContents.send('window-state', true));
  win.on('unmaximize', () => win.webContents.send('window-state', false));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  win.loadFile(page);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
    ipcMain.handle('profile-name', (event) => {
      if (!isWindow(event)) throw new Error('Unknown window');
      return process.env.USERNAME?.trim() || userInfo().username || 'Local user';
    });
    ipcMain.handle('window-control', (event, command) => {
      if (!isWindow(event)) return false;
      switch (command) {
        case 'minimize': win.minimize(); break;
        case 'maximize': win.isMaximized() ? win.unmaximize() : win.maximize(); break;
        case 'close': win.close(); return false;
        case 'zoom-in': win.webContents.setZoomFactor(Math.min(2, win.webContents.getZoomFactor() + 0.1)); break;
        case 'zoom-out': win.webContents.setZoomFactor(Math.max(0.75, win.webContents.getZoomFactor() - 0.1)); break;
        case 'zoom-reset': win.webContents.setZoomFactor(1); break;
      }
      return win?.isMaximized() ?? false;
    });
    openWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
