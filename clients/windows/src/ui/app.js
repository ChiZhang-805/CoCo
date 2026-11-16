'use strict';

const byId = id => document.getElementById(id);
const meeting = byId('meeting');
const pages = ['chat', 'tasks', 'places', 'devices'];
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
  document.querySelectorAll('[data-value="meeting"]').forEach(node => {
    node.textContent = meeting.value.trim() || 'Not set';
  });
  byId('back').disabled = position === 0;
  byId('forward').disabled = position === history.length - 1;
  byId('main').scrollTop = 0;
  if (focus) {
    if (page === 'chat') focusMeeting();
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
document.querySelectorAll('[data-edit-meeting]').forEach(button => {
  button.addEventListener('click', () => navigate('chat'));
});
byId('back').addEventListener('click', () => travel(-1));
byId('forward').addEventListener('click', () => travel(1));
byId('sidebar').addEventListener('click', () => {
  const rail = byId('rail');
  rail.hidden = !rail.hidden;
  document.querySelector('.shell').classList.toggle('collapsed', rail.hidden);
  const toggle = byId('sidebar');
  toggle.setAttribute('aria-expanded', String(!rail.hidden));
  toggle.setAttribute('aria-label', rail.hidden ? 'Show sidebar' : 'Hide sidebar');
  toggle.title = toggle.getAttribute('aria-label');
});
function setMaximized(value) {
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
  byId('meeting-dialog').showModal();
});
meeting.addEventListener('input', () => {
  meeting.removeAttribute('aria-invalid');
  byId('meeting-error').textContent = '';
});
byId('voice').addEventListener('click', () => byId('voice-dialog').showModal());
byId('type-instead').addEventListener('click', () => {
  byId('voice-dialog').close();
  focusMeeting();
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
