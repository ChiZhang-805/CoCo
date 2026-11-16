'use strict';

const activityPanel = byId('activity-panel');
const panelToggle = byId('toggle-panel');
const viewSwitch = byId('switch-activity');
const mapFrame = document.querySelector('.map-viewport');
const mapSheet = document.querySelector('.map-sheet');
const runMarker = byId('run-location');
let wantPanel = false;
let showPhone = false;
let creditShown = false;
function collapseCredit() { byId('map-credit').hidden = true; }
function showMapCredit() {
  if (creditShown || showPhone || activityPanel.hidden) return;
  creditShown = true;
  byId('map-credit').hidden = false;
  setTimeout(collapseCredit, 5000);
}
function applyPanelLayout({ open, width }) {
  const shell = activityPanel.parentElement;
  activityPanel.hidden = !open;
  shell.dataset.panel = open ? (width ? 'docked' : 'overlay') : 'closed';
  activityPanel.style.setProperty('--activity-width', (width || 402) + 'px');
  panelToggle.setAttribute('aria-expanded', String(open));
  setButton(panelToggle, open ? 'Close side panel' : 'Open side panel', 'panel');
  showMapCredit();
}
async function openPanel(open) {
  wantPanel = open;
  const layout = await window.coco.activityPanel(open);
  if (wantPanel !== open) return;
  applyPanelLayout(layout);
  panelToggle.focus({ preventScroll: true });
}
window.coco.onActivityLayout(applyPanelLayout);
panelToggle.onclick = () => openPanel(!wantPanel);
viewSwitch.onclick = () => {
  showPhone = !showPhone;
  byId('map-view').hidden = showPhone;
  byId('phone-view').hidden = !showPhone;
  setButton(viewSwitch, showPhone ? 'Show map' : 'Show phone', showPhone ? 'map' : 'phone');
  showMapCredit();
};
function panelKey(event) {
  if (event.key === 'Escape' && wantPanel && !byId('map-licence').matches(':popover-open')) openPanel(false);
}
activityPanel.addEventListener('keydown', panelKey);
panelToggle.addEventListener('keydown', panelKey);
document.addEventListener('workspace-page', () => {
  const header = document.querySelector('[data-view]:not([hidden]) > header');
  header.append(byId('chat-panel-slot'));
});
byId('share-activity').onclick = () => {
  const title = showPhone ? 'Phone activity' : 'Haining International Campus';
  let lines;
  if (showPhone) {
    lines = [byId('phone-status').textContent, ...Array.from(byId('phone-operations').children, li => li.textContent)];
  } else {
    const latitude = 30.52079 - (camera.y - 0.5) * 0.032;
    const longitude = 120.72156 + (camera.x - 0.5) * 0.014 / Math.cos(30.52079 * Math.PI / 180);
    const link = 'https://www.openstreetmap.org/#map=' + (16 + Math.round(Math.log2(camera.zoom))) + '/' + latitude.toFixed(5) + '/' + longitude.toFixed(5);
    lines = [link];
    if (!byId('run-summary').hidden) lines.push(...['run-name','run-detail','run-eta'].map(id => byId(id).textContent).filter(Boolean));
    lines.push('Map data © OpenStreetMap contributors');
  }
  openShare('Share activity', title, [title, ...lines].join('\n'));
};
byId('map-source').onclick = () => window.coco.openMapLicence();
byId('panel-devices').onclick = () => navigate('devices');

// Positions are normalized over the bundled north-up, equirectangular campus map.
const camera = { x: 0.5, y: 0.5, zoom: 1 };
let destination = { ...camera };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let animation = 0;
let previousFrame = 0;
let runKey = null;
let fix = null;
let following = false;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mapAspect = 2352 / 5376;
for (const [name, x, y, detail] of [
  ['Library',55.092,45.726], ['Auditorium',43.562,52.131], ['Residences',76.099,49.294],
  ['Juanhu Park',46.196,95.919], ['Bell Tower',57.112,46.761,true],
  ['Student Center',58.631,49.037,true], ['East Theatre',48.242,54.579,true]
]) {
  const label = document.createElement('span');
  label.className = detail ? 'map-label minor' : 'map-label';
  label.textContent = name;
  label.style.left = x + '%';
  label.style.top = y + '%';
  mapSheet.append(label);
}
function mapSize(zoom) {
  return Math.max(mapFrame.clientWidth, mapFrame.clientHeight * mapAspect) * zoom;
}
function boundCamera(pose) {
  const size = mapSize(pose.zoom);
  if (!size) return;
  const dx = mapFrame.clientWidth / (2 * size);
  const dy = mapFrame.clientHeight * mapAspect / (2 * size);
  pose.x = clamp(pose.x, dx, 1 - dx);
  pose.y = clamp(pose.y, dy, 1 - dy);
}
function paintMap() {
  const size = mapSize(camera.zoom);
  if (!size) return;
  boundCamera(camera);
  mapSheet.style.width = size + 'px';
  mapSheet.classList.toggle('detailed', camera.zoom >= 2.8);
  const x = mapFrame.clientWidth / 2 - camera.x * size;
  const y = mapFrame.clientHeight / 2 - camera.y * size / mapAspect;
  mapSheet.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
}
function moveCamera(now) {
  animation = 0;
  boundCamera(destination);
  const delta = previousFrame ? Math.min(now - previousFrame, 100) : 16;
  previousFrame = now;
  const blend = reduceMotion.matches ? 1 : 1 - Math.exp(-delta / 145);
  let moving = false;
  for (const key of ['x', 'y', 'zoom']) {
    camera[key] += (destination[key] - camera[key]) * blend;
    if (Math.abs(destination[key] - camera[key]) < 0.00012) camera[key] = destination[key];
    else moving = true;
  }
  paintMap();
  if (moving && mapFrame.clientWidth) animation = requestAnimationFrame(moveCamera);
  else previousFrame = 0;
}
function aimAt(point, zoom) {
  destination = { ...point, zoom };
  if (mapFrame.clientWidth && !animation) animation = requestAnimationFrame(moveCamera);
}
new ResizeObserver(() => {
  if (!mapFrame.clientWidth) return;
  if (following && fix) aimAt(fix, destination.zoom);
  else if (!runKey && !animation) Object.assign(camera, destination);
  paintMap();
}).observe(mapFrame);
function manualCamera() {
  cancelAnimationFrame(animation);
  animation = previousFrame = 0;
  following = false;
  byId('follow-run').hidden = !fix;
  collapseCredit();
}
function zoomAt(factor, offsetX, offsetY) {
  manualCamera();
  const oldSize = mapSize(camera.zoom);
  camera.zoom = clamp(camera.zoom * factor, 1, 8);
  const shift = 1 / oldSize - 1 / mapSize(camera.zoom);
  camera.x += offsetX * shift;
  camera.y += offsetY * shift * mapAspect;
  paintMap();
  destination = { ...camera };
}
function panMap(dx, dy) {
  manualCamera();
  const size = mapSize(camera.zoom);
  camera.x += dx / size;
  camera.y += dy * mapAspect / size;
  paintMap();
  destination = { ...camera };
}
mapFrame.addEventListener('wheel', event => {
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? mapFrame.clientHeight : 1;
  if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    panMap((event.deltaX || event.deltaY) * unit, event.shiftKey ? 0 : event.deltaY * unit);
  } else {
    const rect = mapFrame.getBoundingClientRect();
    const factor = Math.exp(clamp(-event.deltaY * unit * 0.0025, -1, 1));
    zoomAt(factor, event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
  }
}, { passive: false });
let drag = null;
mapFrame.addEventListener('pointerdown', event => {
  if (drag || (event.button !== 0 && event.button !== 1)) return;
  event.preventDefault();
  mapFrame.focus({ preventScroll: true });
  mapFrame.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  mapFrame.classList.add('dragging');
});
mapFrame.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  const dx = drag.x - event.clientX;
  const dy = drag.y - event.clientY;
  if (dx || dy) panMap(dx, dy);
  drag.x = event.clientX;
  drag.y = event.clientY;
});
mapFrame.addEventListener('lostpointercapture', () => {
  drag = null;
  mapFrame.classList.remove('dragging');
});
function recenter() {
  following = !!fix;
  byId('follow-run').hidden = true;
  aimAt(fix || { x: 0.5, y: 0.5 }, fix ? 4 : 1);
}
byId('follow-run').onclick = recenter;
mapFrame.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  switch (event.key) {
    case '+': case '=': zoomAt(1.3, 0, 0); break;
    case '-': zoomAt(1 / 1.3, 0, 0); break;
    case 'ArrowLeft': panMap(-64, 0); break;
    case 'ArrowRight': panMap(64, 0); break;
    case 'ArrowUp': panMap(0, -64); break;
    case 'ArrowDown': panMap(0, 64); break;
    case 'Home': recenter(); break;
    default: return;
  }
  event.preventDefault();
});

function mapPosition(position) {
  if (!Number.isFinite(position?.latitude) || !Number.isFinite(position?.longitude)) return null;
  const x = 0.5 + (position.longitude - 120.72156) * Math.cos(30.52079 * Math.PI / 180) / 0.014;
  const y = 0.5 - (position.latitude - 30.52079) / 0.032;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}
function renderActivity({ run, phone }) {
  trackWorkspaceActivity({ run, phone });
  const key = run ? (run.id ?? run.name ?? 'run') : null;
  const point = mapPosition(run?.position);
  const firstFix = point && (key !== runKey || !fix);
  const ended = runKey !== null && !run;
  runKey = key;
  fix = point;
  runMarker.hidden = !point;
  if (point) {
    runMarker.style.left = point.x * 100 + '%';
    runMarker.style.top = point.y * 100 + '%';
    if (firstFix) recenter();
    else if (following) aimAt(point, destination.zoom);
  } else if (ended) recenter();
  byId('follow-run').hidden = !point || following;
  byId('run-summary').hidden = !run;
  byId('run-name').textContent = run?.name || 'Active run';
  const eta = run?.estimatedArrival ? new Date(run.estimatedArrival) : null;
  byId('run-eta').textContent = eta && Number.isFinite(eta.getTime()) ? 'ETA ' + eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  byId('run-detail').textContent = run?.description || (run && !point ? (run.position ? 'Outside the campus map' : 'Waiting for location') : '');
  byId('phone-status').textContent = phone ? phone.name || 'iPhone' : 'No phone connected';
  const operations = byId('phone-operations');
  operations.replaceChildren();
  for (const label of phone?.operations || []) {
    const item = document.createElement('li');
    item.textContent = label;
    operations.append(item);
  }
  operations.hidden = !operations.childElementCount;
}
let receivedActivity = false;
window.coco.onActivity(snapshot => { receivedActivity = true; renderActivity(snapshot); });
window.coco.currentActivity().then(snapshot => { if (!receivedActivity) renderActivity(snapshot); });
