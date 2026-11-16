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
async function recordStatus(id, name, status, at, instruction, position) {
  const previous = taskRuns.get(id);
  instruction ||= previous?.instruction;
  const last = previous?.positions?.at(-1);
  const newFix = Number.isFinite(position?.latitude) && Math.abs(position.latitude) <= 90 &&
    Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180 &&
    (last?.latitude !== position.latitude || last?.longitude !== position.longitude);
  if (!newFix && previous?.events.at(-1)?.status === status && previous.name === name && previous.instruction === instruction) return;
  const events = [...(previous?.events || [])];
  if (events.at(-1)?.status !== status) events.push({ status, at });
  const next = { id, name, instruction, events, updated: at, positions: previous?.positions };
  if (newFix) next.positions = [...(next.positions || []), {latitude: position.latitude, longitude: position.longitude, at}];
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
      await recordStatus(id, name, status, now, run.instruction, run.position);
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
let mapPage = 1;
let libraryMaps = campusMaps;
const mapsPerPage = 12;
async function drawMaps(revealId) {
  const version = ++mapVersion;
  const maps = await storedList('maps');
  if (version !== mapVersion) return;
  libraryMaps = [...campusMaps, ...maps.sort((a,b) => b.added - a.added)];
  const index = revealId ? libraryMaps.findIndex(entry => entry.id === revealId) : -1;
  if (index >= 0) mapPage = Math.floor(index / mapsPerPage) + 1;
  renderMapPage();
}
function renderMapPage() {
  const pages = Math.ceil(libraryMaps.length / mapsPerPage);
  mapPage = Math.min(mapPage, pages);
  const list = byId('map-list');
  list.replaceChildren();
  for (const url of mapUrls.values()) URL.revokeObjectURL(url);
  mapUrls.clear();
  const start = (mapPage - 1) * mapsPerPage;
  for (const entry of libraryMaps.slice(start, start + mapsPerPage)) {
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
  const pager = byId('map-pages');
  pager.replaceChildren();
  for (let n = 1; n <= pages; n++) {
    const button = element('button', String(n));
    button.type = 'button';
    button.setAttribute('aria-label', 'Page ' + n);
    if (n === mapPage) button.setAttribute('aria-current', 'page');
    button.onclick = () => {
      mapPage = n;
      renderMapPage();
      byId('main').scrollTop = 0;
      pager.querySelector('[aria-current]').focus({ preventScroll: true });
    };
    pager.append(button);
  }
}
byId('library-map-source').onclick = () => window.coco.openMapLicence();
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
    const id = crypto.randomUUID();
    await writeEntry('maps', { id, name: file.name.replace(/\.[^.]+$/, '') || file.name, added: Date.now(), file });
    await drawMaps(id);
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
