const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coco', {
  profileName: () => ipcRenderer.invoke('profile-name'),
  dictation: (command, token) => ipcRenderer.invoke('dictation', command, token),
  onDictation: callback => ipcRenderer.on('dictation-event', (_event, token, kind, value) => callback(token, kind, value)),
  copyReply: text => ipcRenderer.invoke('copy-reply', text),
  saveShare: (title, text) => ipcRenderer.invoke('save-share', title, text),
  readReply: (text, token) => ipcRenderer.invoke('read-reply', text, token),
  stopReading: () => ipcRenderer.invoke('stop-reading'),
  onReadingEnded: callback => ipcRenderer.on('reading-ended', (_event, token, ok) => callback(token, ok)),
  currentActivity: () => ipcRenderer.invoke('current-activity'),
  pairedDevices: () => ipcRenderer.invoke('paired-devices'),
  pairDevice: () => ipcRenderer.invoke('pair-device'),
  edit: command => ipcRenderer.invoke('edit-command', command),
  activityPanel: open => ipcRenderer.invoke('activity-panel', open),
  onActivityLayout: callback => ipcRenderer.on('activity-layout', (_event, layout) => callback(layout)),
  openMapLicence: () => ipcRenderer.invoke('map-licence'),
  onActivity: callback => ipcRenderer.on('activity-changed', (_event, snapshot) => callback(snapshot)),
  control: command => ipcRenderer.invoke('window-control', command),
  onMaximize: callback => ipcRenderer.on('window-state', (_event, value) => callback(value))
});
