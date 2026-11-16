'use strict';

// Illustrative tracks in percent of the Haining basemap, separate from device telemetry.
const campusExamples = [
  { key: 'tea', name: 'Milk tea pickup', icon: 'drink', instruction: 'Pick up my milk tea at the Student Center and meet me at the library entrance.',
    stops: ['Student Center', 'Library entrance'], path: [[58.63,49.04],[60.8,48.7],[60.1,47.5],[57.1,46.9],[55.09,45.73]], start: '2026-11-15T15:12:00+08:00', minutes: 4 },
  { key: 'book', name: 'Library book return', icon: 'parcel', instruction: 'Take my library book from the residences to the library entrance.',
    stops: ['Residences', 'Library entrance'], path: [[76.1,49.29],[72.2,49.7],[66.2,49.2],[62.7,48.2],[59.4,46.1],[55.09,45.73]], start: '2026-11-15T12:24:00+08:00', minutes: 6 },
  { key: 'meet', name: 'Auditorium meetup', icon: 'places', instruction: 'Meet me outside the auditorium after leaving the Student Center.',
    stops: ['Student Center', 'Auditorium'], path: [[58.63,49.04],[54.8,49.1],[52.2,50.2],[47.5,50.4],[43.56,52.13]], start: '2026-11-14T16:40:00+08:00', minutes: 5 },
  { key: 'notebook', name: 'Notebook delivery', icon: 'parcel', instruction: 'Bring my notebook from the auditorium to the residences.',
    stops: ['Auditorium', 'Residences'], path: [[43.56,52.13],[47.9,52.8],[57.1,51.7],[66.9,51.6],[72.4,50.9],[76.1,49.29]], start: '2026-11-14T10:18:00+08:00', minutes: 7 }
];
const sampleHistory = campusExamples.map(example => {
  const start = Date.parse(example.start);
  const end = start + example.minutes * 60000;
  return { id: 'example-' + example.key, scenario: example.key, demo: true, name: example.name, instruction: example.instruction, updated: end,
    events: [{ status: 'Started', at: start }, { status: 'Arrived', at: end }, { status: 'Completed', at: end }] };
});
const previewDuration = 6000;
const taskClock = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
let inspectedId = sampleHistory[0].id;
let inspectorMode = 'route';
let nextCompletion;
let playbackFrame = 0;
let displayedTrack = null;
let trackDuration = 0;

function recordedEvents(run) {
  if (run.previewEnds && run.previewEnds <= Date.now()) {
    return [...run.events, { status: 'Completed', at: run.previewEnds }];
  }
  return run.events;
}
function scenarioOf(run) {
  return run.demo && campusExamples.find(example => example.key === run.scenario);
}
function trackOf(run) {
  const example = scenarioOf(run);
  if (example) return { ...example, campus: campusMaps[0], duration: example.minutes * 60000 };
  if (!run.positions || run.positions.length < 2) return null;
  const first = run.positions[0];
  const duration = run.positions.at(-1).at - first.at;
  for (const campus of campusMaps) {
    const lonSpan = campus.span * (campus.aspect || 1) / Math.cos(campus.lat * Math.PI / 180);
    if (!run.positions.every(p => Math.abs(p.longitude-campus.lon) <= lonSpan/2 && Math.abs(p.latitude-campus.lat) <= campus.span/2)) continue;
    const path = run.positions.map(p => [50 + (p.longitude-campus.lon)*100/lonSpan, 50 - (p.latitude-campus.lat)*100/campus.span]);
    return { campus, path, stops: ['First position', 'Last position'], duration,
      times: duration > 0 ? run.positions.map(p => (p.at - first.at) / duration) : null };
  }
  return null;
}
function actionButton(text, icon, onClick) {
  const button = element('button', '', 'icon-action');
  button.type = 'button';
  button.append(createIcon(icon));
  setButton(button, text, icon);
  button.onclick = onClick;
  return button;
}
function hideTaskPanel() {
  byId('task-inspector').hidden = true;
  activityPanel.classList.remove('task-panel');
  activityPanel.setAttribute('aria-label', 'Activity');
  stopRoutePlayback();
  displayedTrack = null;
  for (const row of byId('task-list').querySelectorAll('.selected')) {
    row.classList.remove('selected');
    row.querySelectorAll('[aria-pressed]').forEach(action => action.setAttribute('aria-pressed', 'false'));
  }
}
function openTaskPanel(run, mode) {
  byId('task-inspector').hidden = false;
  activityPanel.classList.add('task-panel');
  activityPanel.setAttribute('aria-label', 'Task history');
  inspectTask(run, mode);
  return openPanel(true, byId('inspect-heading'));
}
byId('close-task-panel').onclick = () => openPanel(false);
function inspectTask(run, mode) {
  inspectedId = run.id;
  inspectorMode = mode;
  const track = trackOf(run);
  const route = mode === 'route' && !!track;
  byId('inspect-heading').textContent = route ? 'Flight path' : 'Task details';
  byId('inspect-name').textContent = run.name;
  byId('inspect-demo').hidden = !run.demo;
  byId('task-details').hidden = route;
  byId('task-route').hidden = !route;
  byId('inspect-route').disabled = !track;
  byId('inspect-route').setAttribute('aria-pressed', String(route));
  byId('inspect-details').setAttribute('aria-pressed', String(!route));
  byId('inspect-details').onclick = () => inspectTask(run, 'details');
  byId('inspect-route').onclick = () => inspectTask(run, 'route');
  for (const row of byId('task-list').children) {
    const selected = row.dataset.id === run.id && !byId('task-inspector').hidden;
    row.classList.toggle('selected', selected);
    for (const action of row.querySelectorAll('[data-mode]')) {
      action.setAttribute('aria-pressed', String(selected && action.dataset.mode === mode));
    }
  }
  byId('task-instruction').textContent = run.instruction || run.name;
  const timeline = byId('task-events');
  timeline.replaceChildren();
  for (const event of recordedEvents(run)) {
    const item = element('li');
    item.append(element('span', event.status), element('time', taskClock.format(event.at)));
    timeline.append(item);
  }
  if (route && displayedTrack !== run) {
    stopRoutePlayback();
    displayedTrack = run;
    showTaskTrack(track, run);
  } else if (!route) {
    stopRoutePlayback();
    displayedTrack = null;
  }
}
async function rerunTask(original, button) {
  button.disabled = true;
  const now = Date.now();
  const run = { id: crypto.randomUUID(), name: original.name, instruction: original.instruction || original.name,
    demo: true, scenario: original.scenario, positions: original.positions, updated: now, events: [{status: 'Running', at: now}], previewEnds: now + previewDuration };
  try {
    await writeEntry('taskRuns', run);
    taskRuns.set(run.id, run);
    inspectedId = run.id;
    inspectorMode = trackOf(run) ? 'route' : 'details';
    drawTasks();
    if (history[position] !== 'tasks') return;
    await openTaskPanel(run, inspectorMode);
    byId('task-feedback').classList.add('sr-only');
    byId('task-feedback').textContent = 'Demo started: ' + run.name;
    if (wantPanel && !byId('task-inspector').hidden && inspectedId === run.id && inspectorMode === 'route' && !matchMedia('(prefers-reduced-motion: reduce)').matches) playRoute();
  } catch {
    const feedback = byId('task-feedback');
    feedback.classList.remove('sr-only');
    feedback.textContent = 'Could not save the demo run.';
    button.disabled = false;
  }
}
function drawTasks() {
  const now = Date.now();
  const runs = [...taskRuns.values(), ...sampleHistory].sort((a,b) => b.updated - a.updated);
  const list = byId('task-list');
  const active = document.activeElement;
  const focusedRow = active.closest('.run-row')?.dataset.id;
  list.replaceChildren();
  let restoreFocus;
  for (const run of runs) {
    const example = scenarioOf(run);
    const row = element('div', '', 'run-row');
    row.setAttribute('role', 'listitem');
    row.setAttribute('aria-label', run.name);
    row.dataset.id = run.id;
    const glyph = element('span', '', 'run-glyph');
    glyph.append(createIcon(example?.icon || 'tasks'));
    const caption = element('div', '', 'run-caption');
    const meta = element('div', '', 'run-meta');
    if (run.demo) meta.append(element('span', 'Demo', 'demo-tag'));
    meta.append(element('span', recordedEvents(run).at(-1).status), element('time', taskClock.format(run.updated)));
    caption.append(element('strong', run.name), meta);
    const actions = element('div', '', 'run-actions');
    const details = actionButton('View task details', 'tasks', () => openTaskPanel(run, 'details'));
    details.dataset.mode = 'details';
    const route = actionButton('View flight path', 'route', () => openTaskPanel(run, 'route'));
    route.dataset.mode = 'route';
    if (!trackOf(run)) { route.disabled = true; route.title = 'No mapped flight path'; }
    const rerun = actionButton('Run again in demo', 'run-again', () => rerunTask(run, rerun));
    actions.append(details, route, rerun);
    if (focusedRow === run.id) restoreFocus = [...actions.children].find(b => b.title === active.title);
    row.append(glyph, caption, actions);
    list.append(row);
  }
  const selected = runs.find(run => run.id === inspectedId) || runs[0];
  if (!byId('task-inspector').hidden) inspectTask(selected, inspectorMode);
  restoreFocus?.focus({ preventScroll: true });
  clearTimeout(nextCompletion);
  const pending = runs.map(run => run.previewEnds).filter(end => end > now);
  if (pending.length) nextCompletion = setTimeout(drawTasks, Math.max(1, Math.min(...pending) - Date.now()));
}

const routeSlider = byId('route-progress');
const routeLine = byId('route-line');
let routePoints = [];
let timedSegments;
function showTaskTrack(track, run) {
  const height = 1000 / (track.campus.aspect || 1);
  byId('route-basemap').setAttribute('href', campusBasemap(track.campus));
  byId('route-basemap').setAttribute('height', height);
  routePoints = track.path.map(([x,y]) => [x * 10, y * height / 100]);
  let length = 0;
  timedSegments = track.times && routePoints.map(([x,y],i) => {
    if (i) length += Math.hypot(x-routePoints[i-1][0],y-routePoints[i-1][1]);
    return { time: track.times[i], length };
  });
  const path = routePoints.map(([x,y],i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
  routeLine.setAttribute('d', path);
  byId('route-casing').setAttribute('d', path);
  byId('route-description').textContent = (run.demo ? 'Demo flight path' : 'Recorded flight path') + ' from ' + track.stops[0] + ' to ' + track.stops[1] + ' on ' + track.campus.name;
  byId('origin-stop').textContent = track.stops[0];
  byId('destination-stop').textContent = track.stops[1];
  trackDuration = run.previewEnds ? previewDuration : track.duration;
  routeSlider.value = run.previewEnds ? Math.max(0,Math.min(1000,1000 * (Date.now() - run.updated) / previewDuration)) : 0;
  fitRoute();
}
let routeScale = 1;
function fitRoute() {
  const svg = byId('route-drawing');
  const width = svg.clientWidth, height = svg.clientHeight;
  if (!width || !height || !routePoints.length) return;
  const xs = routePoints.map(p => p[0]), ys = routePoints.map(p => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  routeScale = Math.max((xmax-xmin+70)/width, (ymax-ymin+80)/height, 320/width);
  const w = width*routeScale, h = height*routeScale;
  svg.setAttribute('viewBox', [(xmax+xmin-w)/2, (ymax+ymin-h)/2, w,h].join(' '));
  for (const [id,p] of [['route-start',routePoints[0]],['route-end',routePoints.at(-1)]]) {
    byId(id).setAttribute('transform','translate(' + p.join(' ') + ') scale(' + routeScale*0.7 + ')');
  }
  updateRouteMarker();
}
function updateRouteMarker() {
  const fraction = Number(routeSlider.value) / 1000;
  let distance = fraction * routeLine.getTotalLength();
  if (timedSegments) {
    const index = timedSegments.findIndex(segment => segment.time >= fraction);
    if (index > 0) {
      const a = timedSegments[index-1], b = timedSegments[index];
      distance = a.length + (b.length-a.length)*(fraction-a.time)/(b.time-a.time);
    }
  }
  const p = routeLine.getPointAtLength(distance);
  const a = routeLine.getPointAtLength(Math.max(0, distance-1)), b = routeLine.getPointAtLength(distance+1);
  const heading = Math.atan2(b.y-a.y,b.x-a.x) * 180 / Math.PI + 90;
  byId('route-cursor').setAttribute('transform','translate(' + p.x + ' ' + p.y + ') scale(' + routeScale + ') rotate(' + heading + ')');
  const seconds = Math.round(trackDuration*fraction/1000);
  const clock = Math.floor(seconds/60) + ':' + String(seconds%60).padStart(2,'0');
  byId('route-time').value = clock;
  routeSlider.setAttribute('aria-valuetext', clock + ' elapsed');
}
function stopRoutePlayback() {
  cancelAnimationFrame(playbackFrame);
  playbackFrame = 0;
  setButton(byId('play-route'), 'Play route', 'play');
}
function playRoute() {
  if (playbackFrame) { stopRoutePlayback(); return; }
  if (+routeSlider.value === 1000) routeSlider.value = 0;
  const from = performance.now() - Number(routeSlider.value) * previewDuration / 1000;
  setButton(byId('play-route'), 'Pause route', 'pause');
  function step(now) {
    routeSlider.value = Math.min(1000, (now-from)/previewDuration*1000);
    updateRouteMarker();
    if (+routeSlider.value < 1000) playbackFrame = requestAnimationFrame(step);
    else stopRoutePlayback();
  }
  playbackFrame = requestAnimationFrame(step);
}
byId('play-route').onclick = playRoute;
routeSlider.oninput = () => { stopRoutePlayback(); updateRouteMarker(); };
new ResizeObserver(fitRoute).observe(byId('route-drawing'));
document.addEventListener('workspace-page', () => {
  if (history[position] !== 'tasks') stopRoutePlayback();
});
