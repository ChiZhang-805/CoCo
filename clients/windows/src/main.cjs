const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, screen, session, shell } = require('electron');
const childProcess = require('node:child_process');
const { spawn, execFile } = childProcess;
const { readFile, writeFile } = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const { promisify } = require('node:util');
const { createInterface } = require('node:readline');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { userInfo } = require('node:os');

const page = path.join(__dirname, 'ui', 'index.html');
const pageURL = pathToFileURL(page).href;
const windowsPowerShell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const execFileAsync = promisify(execFile);
let deviceQuery;
async function pairedDevices() {
  const script = await readFile(path.join(__dirname, 'paired-devices.ps1'), 'utf8');
  const { stdout } = await execFileAsync(windowsPowerShell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script,'utf16le').toString('base64')], { windowsHide: true, timeout: 15000 });
  return JSON.parse(stdout.trim());
}
let win;
let reader;
const activityWidth = 402;
let panelOpen = false;
let expansion = null;
function isFullWidth() {
  return win.isMaximized() || win.isFullScreen();
}
function panelGeometry() {
  if (!panelOpen) return { open: false, width: 0 };
  const zoom = win.webContents.getZoomFactor();
  if (expansion && !isFullWidth() && win.getBounds().width >= 600 + expansion.width) {
    return { open: true, width: expansion.width / zoom };
  }
  const viewport = win.getContentBounds().width / zoom;
  // Keep at least 600 CSS pixels for the workspace before docking within the existing window.
  const width = viewport >= 900 ? Math.min(activityWidth, Math.round(viewport * 0.28)) : 0;
  return { open: true, width };
}
function publishGeometry() {
  if (win && !win.isDestroyed()) win.webContents.send('activity-layout', panelGeometry());
}
function resizeForPanel(bounds) {
  win.setBounds(bounds);
  // Fractional display scaling can round opposite edges outwards when Electron sets a DIP rectangle.
  const actual = win.getBounds();
  const dw = bounds.width - actual.width;
  const dh = bounds.height - actual.height;
  if ((dw || dh) && Math.abs(dw) <= 2 && Math.abs(dh) <= 2) {
    win.setBounds({ ...bounds, width: bounds.width + dw, height: bounds.height + dh });
  }
}
function contractWindow() {
  if (!expansion || isFullWidth()) return;
  const bounds = win.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(area.width, Math.max(600, bounds.width - expansion.width));
  const x = bounds.x === expansion.openX ? expansion.originalX : bounds.x;
  expansion = null;
  resizeForPanel({ ...bounds, width, x: Math.max(area.x, Math.min(x, area.x + area.width - width)) });
}
function setPanelOpen(open) {
  if (open === panelOpen) return panelGeometry();
  panelOpen = open;
  if (!open) contractWindow();
  else if (!expansion && !isFullWidth()) {
    const bounds = win.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const factor = win.webContents.getZoomFactor();
    const extra = Math.min(Math.round(activityWidth * factor), area.width - bounds.width);
    if (extra >= Math.round(300 * factor)) {
      const width = bounds.width + extra;
      const x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - width));
      expansion = { width: extra, originalX: bounds.x, openX: x };
      resizeForPanel({ ...bounds, x, width });
    }
  }
  return panelGeometry();
}
let activity = { run: null, phone: null };
// The desktop task/device integration publishes complete snapshots on the main process.
app.on('workspace-activity', snapshot => {
  activity = { run: snapshot?.run ?? null, phone: snapshot?.phone ?? null };
  if (win && !win.webContents.isDestroyed()) win.webContents.send('activity-changed', activity);
});
function stopReader() {
  if (reader) reader.kill();
  reader = null;
}
let dictation;
function cancelDictation() {
  if (!dictation) return;
  const { child, token } = dictation;
  dictation = null;
  child.kill();
  if (win && !win.webContents.isDestroyed()) win.webContents.send('dictation-event', token, 'ended');
}
function startDictation(event, token) {
  const script = readFileSync(path.join(__dirname, 'dictation.ps1'), 'utf8');
  if (!isWindow(event) || !win.isFocused()) throw new Error('Focus the CoCo window.');
  cancelDictation();
  stopReader();
  const child = childProcess.spawn(windowsPowerShell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe','pipe','ignore'] });
  dictation = { child, token };
  const send = (kind, value) => {
    if (dictation?.child === child && win && !win.webContents.isDestroyed()) win.webContents.send('dictation-event', token, kind, value);
  };
  createInterface({ input: child.stdout }).on('line', line => {
    const [kind, value] = line.split(' ');
    if (kind === 'text' && value) send(kind, Buffer.from(value, 'base64').toString('utf8'));
    else if (kind === 'ready' || kind === 'error') send(kind, value);
  });
  child.stdin.on('error', () => {});
  child.on('error', () => send('error', 'recognition'));
  child.on('close', code => {
    if (dictation?.child !== child) return;
    if (code) send('error', 'recognition');
    send('ended');
    dictation = null;
  });
}
app.setName('CoCo');
app.setAppUserModelId('org.coco.desktop.windows');

function isWindow(event) {
  return win && event.sender === win.webContents && event.senderFrame?.url === pageURL;
}

function openWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  const width = Math.min(1280, area.width, Math.max(760, area.width - activityWidth));
  const height = Math.min(800, area.height);
  const reserve = Math.min(activityWidth, area.width - width);
  win = new BrowserWindow({
    title: 'CoCo', icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    x: area.x + Math.floor((area.width - width - reserve) / 2), y: area.y + Math.floor((area.height - height) / 2),
    width, height,
    minWidth: 600, minHeight: 440, frame: false, show: false,
    backgroundColor: '#F2F2F4', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.on('maximize', () => win.webContents.send('window-state', true));
  win.on('unmaximize', () => win.webContents.send('window-state', false));
  win.on('resize', publishGeometry);
  win.on('maximize', publishGeometry);
  for (const event of ['unmaximize', 'leave-full-screen']) win.on(event, () => setImmediate(() => {
    if (!win) return;
    if (!panelOpen) contractWindow();
    publishGeometry();
  }));
  win.on('enter-full-screen', publishGeometry);
  win.once('ready-to-show', () => win.show());
  win.on('blur', cancelDictation);
  win.on('closed', () => { cancelDictation(); stopReader(); win = null; });
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
    ipcMain.handle('dictation', async (event, command, token) => {
      if (!isWindow(event) || typeof token !== 'string') throw new Error('Unknown dictation session');
      if (command === 'start') return startDictation(event, token);
      if (dictation?.token !== token) return;
      if (command === 'stop') dictation.child.stdin.end('stop\n');
      if (command === 'cancel') cancelDictation();
    });
    ipcMain.handle('paired-devices', event => {
      if (!isWindow(event)) throw new Error('Unknown window');
      if (!deviceQuery) deviceQuery = pairedDevices().finally(() => { deviceQuery = null; });
      return deviceQuery;
    });
    ipcMain.handle('pair-device', event => {
      if (isWindow(event)) return shell.openExternal('ms-settings:bluetooth');
    });
    ipcMain.handle('edit-command', (event, command) => {
      if (isWindow(event) && ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'].includes(command)) win.webContents[command]();
    });
    ipcMain.handle('activity-panel', (event, open) => {
      if (!isWindow(event)) throw new Error('Unknown window');
      return typeof open === 'boolean' ? setPanelOpen(open) : panelGeometry();
    });
    ipcMain.handle('map-licence', event => {
      if (isWindow(event)) return shell.openExternal('https://www.openstreetmap.org/copyright');
    });
    ipcMain.handle('current-activity', event => {
      if (!isWindow(event)) throw new Error('Unknown window');
      return activity;
    });
    ipcMain.handle('save-share', async (event, title, text) => {
      if (!isWindow(event) || typeof text !== 'string' || typeof title !== 'string') throw new Error('Invalid share');
      const safeTitle = Array.from(title).filter(c => c.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(c)).join('').slice(0, 80);
      const result = await dialog.showSaveDialog(win, { defaultPath: 'CoCo - ' + safeTitle + '.txt', filters: [{ name: 'Text', extensions: ['txt'] }] });
      if (result.canceled) return false;
      await writeFile(result.filePath, text, 'utf8');
      return true;
    });
    ipcMain.handle('stop-reading', event => { if (isWindow(event)) stopReader(); });
    ipcMain.handle('read-reply', (event, text, token) => {
      if (!isWindow(event) || typeof text !== 'string' || typeof token !== 'string') throw new Error('Invalid speech request');
      stopReader();
      const script = "$ErrorActionPreference='Stop'; [Console]::InputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Speech; $voice=[System.Speech.Synthesis.SpeechSynthesizer]::new(); try { $voice.Speak([Console]::In.ReadToEnd()) } finally { $voice.Dispose() }";
      const child = spawn(windowsPowerShell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
      reader = child;
      function finish(ok) {
        if (reader !== child) return;
        reader = null;
        if (win && !win.webContents.isDestroyed()) win.webContents.send('reading-ended', token, ok);
      }
      child.once('error', () => finish(false));
      child.once('close', code => finish(code === 0));
      child.stdin.on('error', () => finish(false));
      child.stdin.end(text, 'utf8');
    });
    ipcMain.handle('copy-reply', (event, text) => {
      if (!isWindow(event) || typeof text !== 'string') throw new Error('Invalid reply');
      clipboard.writeText(text);
    });
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
      if (command.startsWith('zoom-')) publishGeometry();
      return win?.isMaximized() ?? false;
    });
    openWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
