'use strict';

const chatIndex = new Map();
let activeChat = null;
let viewingArchive = false;
let menuChatId;
let noticeTimer;
function notifyChat(text) {
  byId('chat-notice').textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => byId('chat-notice').textContent = '', 6500);
}

const historyDatabase = new Promise((resolve, reject) => {
  const request = indexedDB.open('coco-conversations', 2);
  request.onupgradeneeded = event => {
    if (event.oldVersion < 1) {
      request.result.createObjectStore('chats', { keyPath: 'id' });
      request.result.createObjectStore('turns', { keyPath: ['chatId', 'index'] });
    }
    for (const name of ['taskRuns', 'devices', 'maps']) request.result.createObjectStore(name, { keyPath: 'id' });
  };
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});

async function storedList(store, range) {
  const db = await historyDatabase;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store);
    const request = tx.objectStore(store).getAll(range);
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error);
  });
}
async function saveChat(chat, turn) {
  const db = await historyDatabase;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(turn ? ['chats', 'turns'] : ['chats'], 'readwrite');
    tx.objectStore('chats').put(chat);
    if (turn) tx.objectStore('turns').put(turn);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  chatIndex.set(chat.id, chat);
}

function historyError() {
  notifyChat('Could not access conversation history. Check the available disk space and try again.');
}
const historyReady = storedList('chats').then(chats => {
  chats.forEach(chat => chatIndex.set(chat.id, chat));
  renderHistory();
});
historyReady.catch(historyError);
// Serialize sends, metadata edits and conversation switches in this single-window app.
let pendingHistory = Promise.resolve();
function historyAction(action) {
  pendingHistory = pendingHistory.then(() => historyReady).then(action).catch(historyError);
  return pendingHistory;
}

function suggestTitle(text, image) {
  const examples = new Map([[modes.pickup.prompt, 'Campus pickup plan'], [modes.place.prompt, 'Campus meeting point'], [modes.device.prompt, 'Device connection']]);
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) || image?.name || 'Conversation';
  const chars = Array.from(firstLine.trim().replace(/\s+/g, ' '));
  const base = examples.get(text) || (chars.length > 48 ? chars.slice(0, 47).join('') + '…' : chars.join(''));
  const titles = new Set([...chatIndex.values()].map(chat => chat.title));
  let title = base;
  for (let suffix = 2; titles.has(title); suffix++) title = base + ' (' + suffix + ')';
  return title;
}
function createIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  use.setAttribute('href', '#icon-' + name);
  svg.append(use);
  return svg;
}
function renderHistory() {
  const list = byId('history-list');
  list.replaceChildren();
  byId('history-title').textContent = viewingArchive ? 'Archived' : 'Conversations';
  const filter = byId('archive-filter');
  filter.setAttribute('aria-pressed', String(viewingArchive));
  filter.title = viewingArchive ? 'Show conversations' : 'Show archived conversations';
  filter.setAttribute('aria-label', filter.title);
  const chats = [...chatIndex.values()].filter(chat => chat.archived === viewingArchive)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated - a.updated || a.id.localeCompare(b.id));
  if (viewingArchive && !chats.length) list.textContent = 'No archived conversations';
  for (const chat of chats) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'history-item';
    open.title = chat.title;
    if (chat.id === activeChat && history[position] === 'chat') open.setAttribute('aria-current', 'true');
    if (chat.pinned) open.append(createIcon('pin'));
    const name = document.createElement('span');
    name.textContent = chat.title;
    open.append(name);
    open.onclick = () => historyAction(() => switchChat(chat.id));
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'icon-action row-more';
    more.title = 'Options for ' + chat.title;
    more.setAttribute('aria-label', more.title);
    more.append(createIcon('more'));
    more.popoverTargetElement = byId('history-menu');
    more.onclick = () => {
      menuChatId = chat.id;
      byId('pin-chat').textContent = chat.pinned ? 'Unpin conversation' : 'Pin conversation';
      byId('pin-chat').hidden = chat.archived;
      byId('archive-chat').textContent = chat.archived ? 'Restore conversation' : 'Archive conversation';
    };
    row.append(open, more);
    list.append(row);
  }
}
byId('archive-filter').onclick = () => { viewingArchive = !viewingArchive; renderHistory(); };
byId('browse-chats').onclick = () => {
  sidebarPreference = true;
  updateSidebar();
  (byId('history-list').querySelector('button') || byId('new-chat')).focus();
};
byId('pin-chat').onclick = () => changeHistoryItem('pin');
byId('archive-chat').onclick = () => changeHistoryItem('archive');
function changeHistoryItem(action) {
  const id = menuChatId;
  byId('history-menu').hidePopover();
  historyAction(async () => {
    const chat = chatIndex.get(id);
    const updated = action === 'pin' ? { ...chat, pinned: !chat.pinned }
      : { ...chat, archived: !chat.archived, pinned: false };
    await saveChat(updated);
    if (action === 'archive' && updated.archived && activeChat === id) await switchChat(null, history[position] === 'chat');
    renderHistory();
    const row = [...byId('history-list').querySelectorAll('.history-item')].find(button => button.title === chat.title);
    (row || byId('archive-filter')).focus();
  });
}
