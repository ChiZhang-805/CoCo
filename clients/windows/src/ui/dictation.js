'use strict';

const mic = byId('voice');
const micStatus = byId('voice-status');
let voiceToken = null;
function resetMic() {
  voiceToken = null;
  mic.disabled = false;
  mic.setAttribute('aria-pressed', 'false');
  setButton(mic, 'Voice input', 'mic');
  micStatus.textContent = '';
}
function cancelVoice() {
  if (!voiceToken) return;
  const token = voiceToken;
  resetMic();
  window.coco.dictation('cancel', token).catch(() => {});
}
function insertDictation(text) {
  const previous = message.value.slice(0, message.selectionStart);
  const next = message.value.slice(message.selectionEnd);
  const needsSpace = (a, b) => /[\p{Script=Latin}\d]$/u.test(a) && /^[\p{Script=Latin}\d]/u.test(b);
  message.setRangeText((needsSpace(previous, text) ? ' ' : '') + text + (needsSpace(text, next) ? ' ' : ''), message.selectionStart, message.selectionEnd, 'end');
  message.dispatchEvent(new Event('input', { bubbles: true }));
}
window.coco.onDictation((token, kind, value) => {
  if (voiceToken !== token) return;
  if (kind === 'ready' && !mic.disabled) micStatus.textContent = 'Listening…';
  if (kind === 'text') insertDictation(value);
  if (kind === 'ended') resetMic();
  if (kind === 'error') {
    resetMic();
    const reason = {
      language: 'Install a speech recognition language in Windows Settings, then try again.',
      microphone: 'Check your default microphone and Windows microphone access for desktop apps.'
    };
    notifyChat(reason[value] || 'Windows speech recognition could not finish. Try the microphone again.');
  }
});
mic.onclick = async () => {
  const stopping = !!voiceToken;
  const token = voiceToken || crypto.randomUUID();
  voiceToken = token;
  message.focus();
  mic.disabled = stopping;
  micStatus.textContent = stopping ? 'Finishing…' : 'Starting…';
  mic.setAttribute('aria-pressed', 'true');
  setButton(mic, 'Stop dictation', 'stop');
  try { await window.coco.dictation(stopping ? 'stop' : 'start', token); }
  catch {
    if (voiceToken !== token) return;
    resetMic();
    notifyChat('Could not start Windows speech recognition. Check speech settings and microphone access.');
  }
};
document.addEventListener('workspace-page', () => { if (history[position] !== 'chat') cancelVoice(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') cancelVoice(); });
document.addEventListener('focusin', event => { if (event.target !== mic && event.target !== message) cancelVoice(); });
chatForm.addEventListener('submit', cancelVoice, true);
resetMic();
