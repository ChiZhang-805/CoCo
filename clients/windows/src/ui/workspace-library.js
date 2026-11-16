'use strict';

const taskRuns = new Map();
const rememberedDevices = new Map();
let systemDevices = [];
let workspacePhone = null;
let trackedRun = null;
let deviceRefresh = null;
let pendingMap = null;
const mapUrls = new Map();
const libraryReady = Promise.all([storedList('taskRuns'), storedList('devices')]).then(([runs, devices]) => {
  runs.forEach(run => taskRuns.set(run.id, run));
  devices.forEach(device => rememberedDevices.set(device.id, device));
  drawTasks();
});
function storageError() { notifyChat('Could not access the workspace library.'); }
libraryReady.catch(storageError);

async function writeEntry(store, record, remove = false) {
  const db = await historyDatabase;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const records = tx.objectStore(store);
    if (remove) records.delete(record.id);
    else records.put(record);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
}
function element(tag, text, style) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (style) node.className = style;
  return node;
}
function localTime(value) {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function drawTasks() {
  const list = byId('task-list');
  const expanded = new Set([...list.querySelectorAll('details[open]')].map(node => node.dataset.id));
  list.replaceChildren();
  if (!taskRuns.size) list.append(element('p', 'No task runs yet.', 'empty-list'));
  for (const run of [...taskRuns.values()].sort((a,b) => b.updated - a.updated)) {
    const details = element('details', '', 'run-row');
    details.dataset.id = run.id;
    details.open = expanded.has(run.id);
    const summary = element('summary');
    summary.append(createIcon('tasks'), element('strong', run.name), element('span', run.events.at(-1).status, 'task-state'), element('time', localTime(run.updated)));
    const events = element('ol', '', 'task-timeline');
    for (const event of run.events) {
      const item = element('li');
      item.append(element('span', event.status), element('time', localTime(event.at)));
      events.append(item);
    }
    details.append(summary, events);
    list.append(details);
  }
}
async function recordStatus(id, name, status, at) {
  const previous = taskRuns.get(id);
  if (previous?.events.at(-1)?.status === status && previous.name === name) return;
  const events = [...(previous?.events || [])];
  if (events.at(-1)?.status !== status) events.push({ status, at });
  const next = { id, name, events, updated: at };
  await writeEntry('taskRuns', next);
  taskRuns.set(id, next);
  drawTasks();
}
function statusName(value) {
  const words = String(value || 'running').trim().replace(/[-_]+/g,' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
let pendingRecords = libraryReady;
function trackWorkspaceActivity({ run, phone }) {
  workspacePhone = phone;
  const now = Date.now();
  pendingRecords = pendingRecords.then(async () => {
    const name = run?.name || 'Task';
    const id = run && String(run.id ?? (trackedRun?.name === name ? trackedRun.id : crypto.randomUUID()));
    if (trackedRun && trackedRun.id !== id && !/^(completed?|finished|succeeded|failed|cancelled|canceled|ended|stopped)$/i.test(trackedRun.status)) {
      await recordStatus(trackedRun.id, trackedRun.name, 'Ended', now);
    }
    if (run) {
      const status = statusName(run.status);
      await recordStatus(id, name, status, now);
      trackedRun = { id, name, status };
    } else trackedRun = null;
    if (phone?.id && rememberedDevices.get(phone.id)?.name !== (phone.name || 'iPhone')) {
      const entry = { id: phone.id, name: phone.name || 'iPhone' };
      await writeEntry('devices', entry);
      rememberedDevices.set(entry.id, entry);
    }
    if (history[position] === 'devices') drawDevices();
  }).catch(storageError);
}

function deviceReply() {
  if (workspacePhone) return (workspacePhone.name || 'Your phone') + ' is connected to this workspace.';
  return 'Open Devices to see paired devices or pair another phone through Windows.';
}
function drawDevices() {
  const entries = new Map(systemDevices.map(device => [device.id, { ...device, source: 'Windows Bluetooth' }]));
  for (const device of rememberedDevices.values()) {
    if (!entries.has(device.id)) entries.set(device.id, { ...device, source: 'CoCo', connected: false });
  }
  if (workspacePhone) {
    const id = workspacePhone.id || 'current-session';
    entries.set(id, { id, name: workspacePhone.name || 'iPhone', source: 'CoCo', connected: true });
  }
  const list = byId('device-list');
  list.replaceChildren();
  if (!entries.size && !deviceRefresh) list.append(element('p','Pair a device to add it here.','empty-list'));
  for (const device of [...entries.values()].sort((a,b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name))) {
    const row = element('div', '', 'device-row');
    const label = element('div');
    label.append(element('strong',device.name || 'Bluetooth device'),element('small',device.source));
    row.append(createIcon(device.source === 'CoCo' ? 'phone' : 'devices'), label, element('span',device.connected ? 'Connected' : 'Paired'));
    list.append(row);
  }
}
async function refreshDevices() {
  if (deviceRefresh) return deviceRefresh;
  byId('device-status').textContent = 'Checking paired devices…';
  byId('refresh-devices').disabled = true;
  deviceRefresh = window.coco.pairedDevices().then(devices => {
    systemDevices = devices;
    byId('device-status').textContent = '';
  }).catch(() => { byId('device-status').textContent = 'Windows paired devices could not be loaded. Try Refresh.'; })
    .finally(() => { deviceRefresh = null; byId('refresh-devices').disabled = false; drawDevices(); });
  return deviceRefresh;
}
byId('pair-device').onclick = () => window.coco.pairDevice().catch(() => {
  byId('device-status').textContent = 'Open Windows Settings, then Bluetooth & devices, to pair a device.';
});
byId('refresh-devices').onclick = refreshDevices;
window.addEventListener('focus', () => { if (history[position] === 'devices') refreshDevices(); });

let mapVersion = 0;
async function drawMaps() {
  const version = ++mapVersion;
  const maps = await storedList('maps');
  if (version !== mapVersion) return;
  const list = byId('map-list');
  list.replaceChildren();
  for (const url of mapUrls.values()) URL.revokeObjectURL(url);
  mapUrls.clear();
  for (const entry of [...campusMaps, ...maps.sort((a,b) => b.added - a.added)]) {
    const card = element('button', '', 'map-card');
    card.type = 'button';
    card.title = entry.name;
    const img = element('img');
    img.alt = '';
    img.src = entry.image || URL.createObjectURL(entry.file);
    if (entry.file) mapUrls.set(entry.id, img.src);
    const caption = element('span');
    caption.append(createIcon('map'),element('strong',entry.name),createIcon('next'));
    card.append(img,caption);
    card.onclick = () => {
      if (entry.image) {
        selectCampusMap(entry);
        if (showPhone) viewSwitch.click();
        openPanel(true);
      } else {
        pendingMap = entry;
        byId('saved-map-title').textContent = entry.name;
        byId('saved-map-image').src = img.src;
        byId('saved-map-dialog').showModal();
      }
    };
    list.append(card);
  }
}
byId('campus-map-credit').onclick = () => window.coco.openMapLicence();
byId('add-map').onclick = () => byId('map-file').click();
byId('map-file').onchange = async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const url = URL.createObjectURL(file);
  byId('map-error').textContent = '';
  try {
    if (!['image/jpeg','image/webp','image/png'].includes(file.type)) throw new Error();
    const img = new Image();
    img.src = url;
    await img.decode();
  } catch {
    byId('map-error').textContent = 'Choose a readable PNG, JPEG or WebP map.';
    return;
  } finally { URL.revokeObjectURL(url); }
  try {
    await writeEntry('maps', { id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, '') || file.name, added: Date.now(), file });
    await drawMaps();
  } catch { storageError(); }
};
byId('remove-map').onclick = async () => {
  if (!pendingMap) return;
  try {
    await writeEntry('maps', pendingMap, true);
    byId('saved-map-dialog').close();
    await drawMaps();
  } catch { storageError(); }
};
byId('saved-map-dialog').onclose = () => { pendingMap = null; byId('saved-map-image').removeAttribute('src'); };
document.addEventListener('workspace-page', () => {
  if (history[position] === 'maps') drawMaps().catch(storageError);
  if (history[position] === 'devices') { drawDevices(); refreshDevices(); }
});
