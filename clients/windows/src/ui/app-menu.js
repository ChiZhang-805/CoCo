'use strict';

const bar = byId('menu-bar');
const commandMenu = byId('command-menu');
const menuHeads = [...bar.querySelectorAll('[data-menu]')];
let menuHead = null;
let menuOrigin = null;
let barFocus = false;
let altAlone = false;
const groups = {
  File: [
    ['New chat','Ctrl+N',() => byId('new-chat').click()],
    ['Export conversation…','Ctrl+Shift+S',async () => {
      const data = conversationExport();
      if (data) await window.coco.saveShare(data.title, data.text);
    }, () => !!activeChat],
    null, ['Close window','Ctrl+W',() => window.coco.control('close')]
  ],
  Edit: [
    ['Undo','Ctrl+Z','undo'], ['Redo','Ctrl+Y','redo'], null,
    ['Cut','Ctrl+X','cut'], ['Copy','Ctrl+C','copy'], ['Paste','Ctrl+V','paste'], null,
    ['Select all','Ctrl+A','selectAll']
  ],
  View: [
    ['Back','Alt+Left',() => travel(-1),() => !byId('back').disabled],
    ['Forward','Alt+Right',() => travel(1),() => !byId('forward').disabled], null,
    ['Toggle sidebar','Ctrl+B',() => sidebarToggle.click()],
    ['Toggle Activity','Ctrl+Shift+A',() => openPanel(!wantPanel)], null,
    ['Zoom in','Ctrl++',() => window.coco.control('zoom-in')],
    ['Zoom out','Ctrl+−',() => window.coco.control('zoom-out')],
    ['Actual size','Ctrl+0',() => window.coco.control('zoom-reset')]
  ],
  Help: [
    ['Keyboard shortcuts','F1',() => byId('shortcuts-dialog').showModal()],
    ['About CoCo','',() => byId('about-dialog').showModal()]
  ]
};
function available(command) {
  if (command[3]) return command[3]();
  if (typeof command[2] !== 'string') return true;
  const editable = menuOrigin?.matches('textarea, input:not([type=file]), [contenteditable=true]');
  if (['undo','redo','cut','paste'].includes(command[2])) return editable;
  return true;
}
function dismissMenu(restore = true) {
  if (commandMenu.matches(':popover-open')) commandMenu.hidePopover();
  menuHead?.setAttribute('aria-expanded','false');
  menuHead = null;
  barFocus = false;
  if (restore && menuOrigin?.isConnected) menuOrigin.focus({ preventScroll: true });
}
async function runCommand(command) {
  if (!available(command)) return;
  dismissMenu();
  try {
    if (typeof command[2] === 'string') await window.coco.edit(command[2]);
    else await command[2]();
  } catch { notifyChat('The command could not be completed.'); }
}
function focusHead(head) {
  for (const item of menuHeads) item.tabIndex = item === head ? 0 : -1;
  head.focus({ preventScroll: true });
}
function openMenu(head, focusItem = true) {
  if (!menuHead && !barFocus && !bar.contains(document.activeElement)) menuOrigin = document.activeElement;
  if (menuHead) dismissMenu(false);
  barFocus = true;
  menuHead = head;
  focusHead(head);
  head.setAttribute('aria-expanded','true');
  commandMenu.setAttribute('aria-label',head.dataset.menu);
  commandMenu.replaceChildren();
  for (const cmd of groups[head.dataset.menu]) {
    if (!cmd) { commandMenu.append(document.createElement('hr')); continue; }
    const item = element('button');
    item.type = 'button';
    item.setAttribute('role','menuitem');
    item.tabIndex = -1;
    item.disabled = !available(cmd);
    item.append(element('span',cmd[0]),element('kbd',cmd[1]));
    item.onclick = () => runCommand(cmd);
    commandMenu.append(item);
  }
  commandMenu.showPopover({ source: head });
  if (focusItem) commandMenu.querySelector('button:enabled')?.focus();
}
function adjacentHead(step) {
  const head = menuHead || document.activeElement;
  return menuHeads[(menuHeads.indexOf(head) + step + menuHeads.length) % menuHeads.length];
}
for (const head of menuHeads) {
  head.setAttribute('aria-controls','command-menu');
  head.onpointerdown = event => { event.preventDefault(); };
  head.onclick = () => menuHead === head ? dismissMenu() : openMenu(head);
  head.onpointerenter = () => { if (menuHead && menuHead !== head) openMenu(head); };
}
bar.addEventListener('focusin', event => {
  if (!barFocus && !menuHead && event.relatedTarget && !bar.contains(event.relatedTarget)) menuOrigin = event.relatedTarget;
});
document.addEventListener('pointerdown', event => {
  if (menuHead && !bar.contains(event.target) && !commandMenu.contains(event.target)) dismissMenu(false);
});
function toggleBarFocus() {
  if (menuHead || barFocus) dismissMenu();
  else {
    menuOrigin = document.activeElement;
    barFocus = true;
    focusHead(menuHeads[0]);
  }
}
document.addEventListener('keyup', event => {
  if (event.key !== 'Alt' || !altAlone) return;
  altAlone = false;
  event.preventDefault();
  toggleBarFocus();
});
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.isComposing) return;
  const key = event.key;
  altAlone = key === 'Alt' && !event.ctrlKey;
  if (event.altKey && !event.ctrlKey && /^[fevh]$/i.test(key)) {
    event.preventDefault();
    openMenu(menuHeads.find(head => head.dataset.menu[0] === key.toUpperCase()));
    return;
  }
  if (key === 'F10') {
    if (event.repeat) return;
    event.preventDefault();
    toggleBarFocus();
    return;
  }
  if (menuHead || bar.contains(document.activeElement)) {
    if (key === 'Tab') { dismissMenu(); return; }
    if (key === 'Escape') { event.preventDefault(); dismissMenu(); return; }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const head = adjacentHead(key === 'ArrowLeft' ? -1 : 1);
      if (menuHead) openMenu(head); else focusHead(head);
      return;
    }
    if (['ArrowDown','ArrowUp','Home','End'].includes(key)) {
      event.preventDefault();
      if (!menuHead) { openMenu(document.activeElement); return; }
      const items = [...commandMenu.querySelectorAll('button:enabled')];
      const index = items.indexOf(document.activeElement);
      const target = key === 'Home' ? 0 : key === 'End' ? items.length - 1 : (index + (key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      items[target]?.focus();
      return;
    }
  }
  const shortcuts = { 'Ctrl+N': groups.File[0], 'Ctrl+Shift+S': groups.File[1], 'Ctrl+W': groups.File[3],
    'Ctrl+B': groups.View[3], 'Ctrl+Shift+A': groups.View[4], 'F1': groups.Help[0] };
  const chord = (event.ctrlKey ? 'Ctrl+' : '') + (event.shiftKey ? 'Shift+' : '') + key.toUpperCase();
  if (!event.altKey && shortcuts[chord]) {
    event.preventDefault();
    if (!menuHead && !barFocus) menuOrigin = document.activeElement;
    runCommand(shortcuts[chord]);
  }
});
for (const group of Object.values(groups)) {
  for (const command of group) if (command?.[1]) byId('shortcut-list').append(element('dt',command[0]),element('dd',command[1]));
}
