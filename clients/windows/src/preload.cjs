const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coco', {
  profileName: () => ipcRenderer.invoke('profile-name'),
  control: command => ipcRenderer.invoke('window-control', command),
  onMaximize: callback => ipcRenderer.on('window-state', (_event, value) => callback(value))
});
