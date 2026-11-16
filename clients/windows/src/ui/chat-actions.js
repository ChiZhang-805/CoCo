'use strict';

let shareText = '';
let shareName = '';
function openShare(title, name, text) {
  shareName = name;
  shareText = text;
  byId('share-title').textContent = title;
  byId('share-preview').textContent = text;
  byId('share-status').textContent = '';
  byId('share-dialog').showModal();
}
function conversationExport() {
  const chat = chatIndex.get(activeChat);
  if (!chat) return null;
  const turns = currentTurns.map(turn => {
    const lines = ['You', turn.text];
    if (turn.image) lines.push('[Image: ' + turn.image.name + ']');
    return [...lines, '', 'CoCo', turn.reply.text].join('\n');
  });
  return { title: chat.title, text: [chat.title, ...turns].join('\n\n') };
}
byId('share-chat').onclick = () => {
  const data = conversationExport();
  if (data) openShare('Share conversation', data.title, data.text);
};
byId('share-copy').onclick = async () => {
  try {
    await window.coco.copyReply(shareText);
    byId('share-status').textContent = 'Copied to clipboard.';
  } catch { byId('share-status').textContent = 'Text could not be copied.'; }
};
byId('share-save').onclick = async () => {
  try {
    if (await window.coco.saveShare(shareName, shareText)) byId('share-status').textContent = 'Text file saved.';
  } catch { byId('share-status').textContent = 'Could not save the file. Choose another location.'; }
};

let reading = null;
function setButton(button, label, icon) {
  button.title = label;
  button.setAttribute('aria-label', label);
  button.querySelector('use').setAttribute('href', '#icon-' + icon);
}
function clearReading() {
  if (reading) setButton(reading.button, 'Read aloud', 'listen');
  reading = null;
}
function stopReading() {
  if (!reading) return;
  clearReading();
  window.coco.stopReading().catch(() => notifyChat('Could not stop reading.'));
}
window.coco.onReadingEnded((token, ok) => {
  if (reading?.token !== token) return;
  clearReading();
  if (!ok) notifyChat('Windows could not read this reply. Check the installed speech voice and audio output.');
});
async function readReply(button, text) {
  if (reading?.button === button) { stopReading(); return; }
  clearReading();
  const token = crypto.randomUUID();
  reading = { token, button };
  setButton(button, 'Stop reading', 'stop');
  try { await window.coco.readReply(text, token); }
  catch {
    if (reading?.token === token) clearReading();
    notifyChat('Windows speech is unavailable.');
  }
}

let ratingTarget;
function showRating(button, record) {
  ratingTarget = { button, record };
  for (const choice of document.querySelectorAll('[data-rating]')) {
    choice.setAttribute('aria-pressed', String(choice.dataset.rating === record.rating && !!record.rating));
    if (!choice.dataset.rating) choice.disabled = !record.rating;
  }
  byId('rating-dialog').showModal();
}
function reflectRating(button, rating) {
  button.classList.toggle('is-rated', !!rating);
  button.title = rating ? 'Rate reply · ' + (rating === 'helpful' ? 'Helpful' : 'Not helpful') : 'Rate reply';
  button.setAttribute('aria-label', button.title);
}
document.querySelectorAll('[data-rating]').forEach(choice => {
  choice.onclick = () => {
    const { button, record } = ratingTarget;
    historyAction(async () => {
      const rating = choice.dataset.rating;
      await saveChat(chatIndex.get(record.chatId), { ...record, rating });
      record.rating = rating;
      reflectRating(button, rating);
      byId('rating-dialog').close();
    });
  };
});
function bindReplyActions(turn, record) {
  const action = key => turn.querySelector('[data-action="' + key + '"]');
  const rate = action('rate');
  reflectRating(rate, record.rating);
  rate.onclick = () => showRating(rate, record);
  action('share').onclick = () => openShare('Share reply', chatIndex.get(record.chatId).title, record.reply.text);
  action('read').onclick = event => readReply(event.currentTarget, record.reply.text);
  action('copy').onclick = async event => {
    const button = event.currentTarget;
    try {
      await window.coco.copyReply(record.reply.text);
      setButton(button, 'Reply copied', 'check');
    } catch { notifyChat('Could not copy the reply.'); }
  };
}

document.addEventListener('workspace-page', () => {
  renderHistory();
  if (history[position] !== 'chat') stopReading();
});
