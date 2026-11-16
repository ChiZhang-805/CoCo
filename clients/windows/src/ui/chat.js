'use strict';

const chatPage = document.querySelector('.chat-page');
const chatForm = byId('chat-form');
const message = byId('message');
const transcript = byId('transcript');
const toolsMenu = byId('chat-tools');
const modeButtons = [...toolsMenu.querySelectorAll('[data-mode]')];
const modes = {
  pickup: { prompt: 'What is my current pickup plan?', placeholder: 'Ask CoCo about your campus pickup…' },
  place: { prompt: 'Where is my meeting point?', placeholder: 'Ask about your meeting point…' },
  device: { prompt: 'Is a device connected?', placeholder: 'Ask about your devices…' }
};
let mode = 'pickup';
let attachment = null;
let imageRequest = 0;

function selectMode(key) {
  mode = key;
  for (const button of modeButtons) {
    const selected = button.dataset.mode === key;
    button.setAttribute('aria-pressed', String(selected));
    if (selected) byId('mode-chip').textContent = button.textContent.trim();
  }
  message.placeholder = modes[key].placeholder;
}

function updateSend() {
  byId('send').disabled = !message.value.trim() && !attachment;
}

modeButtons.forEach(button => button.addEventListener('click', () => {
  selectMode(button.dataset.mode);
  toolsMenu.hidePopover();
  message.focus();
}));
document.querySelectorAll('[data-suggestion]').forEach(button => button.addEventListener('click', () => {
  selectMode(button.dataset.suggestion);
  message.value = modes[mode].prompt;
  updateSend();
  message.focus();
}));
toolsMenu.addEventListener('toggle', () => {
  if (toolsMenu.matches(':popover-open')) toolsMenu.querySelector('[aria-pressed="true"]').focus();
});
toolsMenu.addEventListener('keydown', event => {
  const buttons = [...toolsMenu.querySelectorAll('button')];
  const index = buttons.indexOf(document.activeElement);
  const target = { ArrowDown: (index + 1) % buttons.length, ArrowUp: (index - 1 + buttons.length) % buttons.length,
    Home: 0, End: buttons.length - 1 }[event.key];
  if (typeof target === 'number') {
    event.preventDefault();
    buttons[target].focus();
  }
});

function clearDraftImage(keepUrl = false) {
  imageRequest++;
  if (attachment && !keepUrl) URL.revokeObjectURL(attachment.url);
  attachment = null;
  byId('draft-image').hidden = true;
  byId('draft-image').querySelector('img').removeAttribute('src');
  byId('attachment-error').textContent = '';
  updateSend();
}

byId('attach-image').addEventListener('click', () => {
  toolsMenu.hidePopover();
  message.focus();
  byId('image-file').click();
});
byId('image-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  const request = ++imageRequest;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    byId('attachment-error').textContent = 'Choose a PNG, JPEG or WebP image.';
    return;
  }
  const url = URL.createObjectURL(file);
  const preview = new Image();
  preview.src = url;
  try {
    await preview.decode();
  } catch {
    URL.revokeObjectURL(url);
    if (request === imageRequest) byId('attachment-error').textContent = 'This image could not be opened.';
    return;
  }
  if (request !== imageRequest) {
    URL.revokeObjectURL(url);
    return;
  }
  clearDraftImage();
  attachment = { url, name: file.name, file };
  byId('draft-image').querySelector('img').src = url;
  byId('draft-image').hidden = false;
  updateSend();
});
byId('remove-image').addEventListener('click', () => {
  clearDraftImage();
  message.focus();
});

function localReply(text) {
  const place = { text: 'Your meeting point is ' + savedMeetingPoint + ' on Haining International Campus.', card: 'Meeting point', detail: savedMeetingPoint, target: 'edit' };
  const device = { text: deviceReply(), card: 'Devices', detail: 'Paired devices', target: 'devices' };
  const pickup = { text: 'Your current task is a milk tea pickup on Haining International Campus. The meeting point is ' + savedMeetingPoint + '. You can review the draft in Tasks and complete the order on your iPhone.', card: 'Milk tea pickup', detail: 'Task draft · ' + savedMeetingPoint, target: 'tasks' };
  if (!text) return { text: 'You can add a note about the pickup or meeting point below.' };
  if (/\b(devices?|connected|connection)\b/i.test(text)) return device;
  if (/\b(meet|meeting|location|where)\b/i.test(text)) return place;
  if (/\b(pickup|task|plan|order|tea)\b/i.test(text)) return pickup;
  if (mode === 'place') return place;
  if (mode === 'device') return device;
  return { text: 'I can show the pickup draft, look up your meeting point, or check the local device status. Which would you like to see?' };
}

message.addEventListener('input', updateSend);
message.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    if (!byId('send').disabled) chatForm.requestSubmit();
  }
});

let currentTurns = [];
const drafts = new Map();
const visibleImageUrls = [];

function appendTurn(record) {
  const { text, image, reply, created } = record;
  const turn = byId('chat-turn').content.firstElementChild.cloneNode(true);
  const bubble = turn.querySelector('.user-message');
  bubble.textContent = text;
  bubble.hidden = !text;
  if (image) {
    const thumbnail = turn.querySelector('.user-image');
    thumbnail.src = URL.createObjectURL(image.file);
    visibleImageUrls.push(thumbnail.src);
    thumbnail.alt = image.name;
    thumbnail.hidden = false;
  }
  turn.querySelector('.reply').textContent = reply.text;
  const card = turn.querySelector('.reply-card');
  card.hidden = !reply.card;
  if (reply.card) {
    card.querySelector('strong').textContent = reply.card;
    card.querySelector('small').textContent = reply.detail;
    card.querySelector('.card-icon use').setAttribute('href', '#icon-' + ({ edit: 'places', devices: 'devices', tasks: 'tasks' }[reply.target]));
    card.onclick = () => reply.target === 'edit' ? editMeetingPoint(card) : navigate(reply.target);
  }
  const time = turn.querySelector('time');
  const date = new Date(created);
  time.dateTime = date.toISOString();
  time.title = date.toLocaleString();
  time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeButton = time.parentElement;
  timeButton.setAttribute('aria-label', 'Reply time: ' + time.title);
  timeButton.onclick = () => { byId('reply-time').textContent = time.title; };
  bindReplyActions(turn, record);
  transcript.append(turn);
}

function updateThreadView() {
  const chat = chatIndex.get(activeChat);
  byId('chat-title').textContent = chat?.title || 'Chat';
  byId('chat-title').title = chat?.title || 'Chat';
  byId('welcome').hidden = !!chat;
  byId('share-chat').disabled = !chat;
  transcript.hidden = !chat;
  chatPage.classList.toggle('in-thread', !!chat);
  renderHistory();
}

async function switchChat(id, show = true) {
  if (activeChat !== id) {
    cancelVoice();
    const records = id ? await storedList('turns', IDBKeyRange.bound([id, 0], [id, Infinity])) : [];
    drafts.set(activeChat, { text: message.value, mode, attachment });
    clearDraftImage(true);
    stopReading();
    visibleImageUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
    activeChat = id;
    currentTurns = records;
    transcript.replaceChildren();
    records.forEach(appendTurn);
    const draft = drafts.get(id);
    message.value = draft?.text || '';
    selectMode(draft?.mode || 'pickup');
    attachment = draft?.attachment || null;
    if (attachment) {
      byId('draft-image').querySelector('img').src = attachment.url;
      byId('draft-image').hidden = false;
    }
    drafts.delete(id);
    updateSend();
  }
  if (show) navigate('chat');
  updateThreadView();
  transcript.scrollTop = transcript.scrollHeight;
}

let sending = false;
chatForm.addEventListener('submit', event => {
  event.preventDefault();
  const text = message.value.trim();
  if (sending || (!text && !attachment)) return;
  sending = true;
  const originalChat = activeChat;
  const originalDraft = message.value;
  const image = attachment;
  const reply = localReply(text);
  historyAction(async () => {
    if (originalChat !== activeChat) return;
    const now = Date.now();
    const chat = { ...(chatIndex.get(activeChat) || {
      id: crypto.randomUUID(), title: suggestTitle(text, image), pinned: false
    }), archived: false, updated: now };
    const record = { chatId: chat.id, index: currentTurns.length, text, reply, created: now, rating: '',
      image: image ? { name: image.name, file: image.file } : null };
    await saveChat(chat, record);
    activeChat = chat.id;
    viewingArchive = false;
    currentTurns.push(record);
    appendTurn(record);
    updateThreadView();
    if (message.value === originalDraft) message.value = '';
    if (attachment === image) clearDraftImage();
    updateSend();
    message.focus();
    transcript.scrollTop = transcript.scrollHeight;
  }).finally(() => { sending = false; });
});
byId('new-chat').addEventListener('click', () => historyAction(() => {
  viewingArchive = false;
  return switchChat(null);
}));
