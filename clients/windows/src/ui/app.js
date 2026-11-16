'use strict';

const byId = id => document.getElementById(id);
const meeting = byId('meeting');
let savedMeetingPoint = meeting.value;
let meetingOpener;
const pages = ['chat', 'tasks', 'maps', 'devices'];
let history = ['chat'];
let position = 0;

function focusMeeting() {
  meeting.focus();
  meeting.setSelectionRange(meeting.value.length, meeting.value.length);
}

function showPage(focus = true) {
  const page = history[position];
  document.querySelectorAll('[data-view]').forEach(view => {
    view.hidden = view.dataset.view !== page;
  });
  document.querySelectorAll('[data-page]').forEach(link => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-value="meeting"]').forEach(node => node.textContent = savedMeetingPoint);
  if (page !== 'chat') byId('chat-tools').hidePopover();
  byId('back').disabled = position === 0;
  byId('forward').disabled = position === history.length - 1;
  byId('main').scrollTop = 0;
  document.dispatchEvent(new Event('workspace-page'));
  if (focus) {
    if (page === 'chat') byId('message').focus();
    else byId(page + '-heading').focus();
  }
}

function navigate(page) {
  if (!pages.includes(page)) return;
  if (history[position] !== page) {
    history = history.slice(0, position + 1);
    history.push(page);
    position++;
  }
  showPage();
}

function travel(offset) {
  if (position + offset < 0 || position + offset >= history.length) return;
  position += offset;
  showPage();
}

document.querySelectorAll('[data-page]').forEach(button => {
  button.addEventListener('click', () => navigate(button.dataset.page));
});
function editMeetingPoint(opener) {
  meetingOpener = byId('chat-tools').contains(opener) ? byId('tools') : opener;
  byId('chat-tools').hidePopover();
  meeting.value = savedMeetingPoint;
  meeting.removeAttribute('aria-invalid');
  byId('meeting-error').textContent = '';
  byId('edit-dialog').showModal();
  focusMeeting();
}
document.querySelectorAll('[data-edit-meeting]').forEach(button => {
  button.addEventListener('click', () => editMeetingPoint(button));
});
byId('back').addEventListener('click', () => travel(-1));
byId('forward').addEventListener('click', () => travel(1));
const sidebarToggle = byId('sidebar');
let sidebarPreference;

function updateSidebar() {
  const expanded = sidebarPreference ?? (byId('workspace').clientWidth > 530);
  byId('rail').classList.toggle('compact', !expanded);
  sidebarToggle.setAttribute('aria-expanded', String(expanded));
  sidebarToggle.title = expanded ? 'Collapse sidebar' : 'Expand sidebar';
  sidebarToggle.setAttribute('aria-label', sidebarToggle.title);
  sidebarToggle.querySelector('use').setAttribute('href', expanded ? '#icon-collapse' : '#icon-expand');
}

sidebarToggle.addEventListener('click', () => {
  sidebarPreference = sidebarToggle.getAttribute('aria-expanded') !== 'true';
  updateSidebar();
});
new ResizeObserver(updateSidebar).observe(byId('workspace'));
updateSidebar();
function setMaximized(value) {
  document.documentElement.classList.toggle('maximized', value);
  const button = byId('maximize');
  const label = value ? 'Restore' : 'Maximize';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.querySelector('use').setAttribute('href', value ? '#icon-restore' : '#icon-maximize');
}
window.coco.onMaximize(setMaximized);
window.coco.control('state').then(setMaximized);
for (const action of ['minimize', 'maximize', 'close']) {
  byId(action).addEventListener('click', () => window.coco.control(action));
}

document.addEventListener('keydown', event => {
  if (event.ctrlKey && !event.altKey) {
    const command = { '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', '0': 'zoom-reset' }[event.key];
    if (typeof command === 'string') {
      event.preventDefault();
      window.coco.control(command);
      return;
    }
  }
  if (document.querySelector('dialog[open]')) return;
  if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    travel(event.key === 'ArrowLeft' ? -1 : 1);
  }
});

byId('meeting-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = meeting.value.trim();
  if (!value) {
    meeting.setAttribute('aria-invalid', 'true');
    byId('meeting-error').textContent = 'Enter a meeting point.';
    focusMeeting();
    return;
  }
  byId('preview-value').textContent = value;
  savedMeetingPoint = value;
  document.querySelectorAll('[data-value="meeting"]').forEach(node => node.textContent = value);
  byId('edit-dialog').close();
  byId('meeting-dialog').showModal();
});
for (const id of ['edit-dialog', 'meeting-dialog']) {
  byId(id).addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) meetingOpener?.focus();
  });
}
meeting.addEventListener('input', () => {
  meeting.removeAttribute('aria-invalid');
  byId('meeting-error').textContent = '';
});
byId('order').addEventListener('click', () => byId('order-dialog').showModal());
byId('profile').addEventListener('click', () => byId('profile-dialog').showModal());
document.querySelectorAll('[data-dismiss]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});
window.coco.profileName().then(name => {
  byId('display-name').textContent = name;
  byId('profile-name').textContent = name;
  byId('profile').title = name;
});
showPage(false);
