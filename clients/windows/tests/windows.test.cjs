const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { _electron } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const packaged = process.argv.includes('--packaged');
const executable = packaged
  ? process.env.COCO_TEST_EXECUTABLE || path.join(root, 'dist', 'win-unpacked', 'CoCo.exe')
  : require('electron');

async function waitWindowState(app, property, expected) {
  for (let i = 0; i < 60; i++) {
    const actual = await app.evaluate(({ BrowserWindow }, name) => BrowserWindow.getAllWindows()[0][name](), property);
    if (actual === expected) return;
    await delay(50);
  }
  assert.fail('Window did not reach ' + property + '=' + expected);
}

test('Windows desktop', async t => {
  const profile = await mkdtemp(path.join(tmpdir(), 'coco-window-test-'));
  const args = ['--user-data-dir=' + profile];
  if (!packaged) args.push(root);
  const env = { ...process.env, USERNAME: 'Alex Chen' };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => _electron.launch({ executablePath: executable, args, env, cwd: root });
  let app;
  t.after(async () => {
    if (app) await app.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  });

  app = await launch();
  const page = await app.firstWindow();
  const button = name => page.getByRole('button', { name, exact: true });
  const meeting = page.getByRole('textbox', { name: 'Meeting point' });
  const message = page.getByRole('textbox', { name: 'Message CoCo' });
  async function checkAnchoredMenu(invoker, selector, align = 'left') {
    const trigger = await invoker.boundingBox();
    const menu = await page.locator(selector).boundingBox();
    const below = menu.y - trigger.y - trigger.height;
    const above = trigger.y - menu.y - menu.height;
    assert.ok([below, above].some(gap => gap >= -1 && gap <= 8), JSON.stringify({selector, trigger, menu}));
    const offset = align === 'right' ? menu.x + menu.width - trigger.x - trigger.width : menu.x - trigger.x;
    assert.ok(Math.abs(offset) <= 4, JSON.stringify({selector, trigger, menu}));
    const fits = await page.locator(selector).evaluate(node => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.top >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
    });
    assert.ok(fits);
  }
  function checkConversationMenu(title) {
    return checkAnchoredMenu(button('Options for ' + title), '#history-menu');
  }
  async function checkSidebarAlignment() {
    const [collapse, archive] = await Promise.all(['#sidebar .icon', '#archive-filter .icon'].map(id => page.locator(id).boundingBox()));
    assert.ok(Math.abs(collapse.x + collapse.width / 2 - archive.x - archive.width / 2) < 1);
    const [left, right] = await page.evaluate(() => [document.querySelector('#workspace-nav').getBoundingClientRect().left,
      innerWidth - document.querySelector('#workspace').getBoundingClientRect().right]);
    assert.ok(Math.abs(left - right) < 1);
  }
  async function checkMapsFit() {
    const fits = await page.evaluate(() => {
      const main = document.querySelector('main');
      const header = document.querySelector('#maps-heading').closest('header').getBoundingClientRect();
      const pager = document.querySelector('#map-pages').getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll('.map-card'));
      return main.scrollHeight === main.clientHeight && main.scrollWidth === main.clientWidth &&
        pager.bottom <= main.getBoundingClientRect().bottom && cards.length > 0 && cards.every(card => {
          const box = card.getBoundingClientRect();
          return box.top >= header.bottom && box.bottom <= pager.top && card.querySelector('img').clientHeight > 0;
        });
    });
    assert.ok(fits, 'Map cards, captions and page controls must fit without scrolling');
  }
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('#display-name').filter({ hasText: 'Alex Chen' }).waitFor();

  await t.test('offline artwork, fonts and the chat welcome screen', async () => {
    await page.getByRole('heading', { name: 'How can I help on campus?' }).waitFor();
    assert.equal(await message.inputValue(), '');
    assert.equal(await button('Send message').isDisabled(), true);
    assert.equal(await button('Back').isDisabled(), true);
    assert.equal(await button('Forward').isDisabled(), true);
    const ready = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.querySelectorAll('img[src]')].every(image => image.complete && image.naturalWidth > 0)
        && document.fonts.check('800 18px Nunito') && document.fonts.check('400 16px Noto')
        && getComputedStyle(document.body).backgroundColor === 'rgb(242, 242, 244)';
    });
    assert.equal(ready, true);
    const alignment = await page.evaluate(() => ['nav button .icon','#history-title','.profile .avatar'].map(selector => document.querySelector(selector).getBoundingClientRect().left));
    assert.ok(Math.max(...alignment) - Math.min(...alignment) < 1);
    await checkSidebarAlignment();
    assert.ok((await page.locator('#close .icon').boundingBox()).width <= 17);
    for (const selector of ['nav [data-page="maps"] span',  'nav [data-page="devices"] span' ]) {
      const lines = await page.locator(selector).evaluate(n => {
        const range = document.createRange();
        range.selectNodeContents(n);
        return range.getClientRects().length;
      });
      assert.equal(lines, 1, 'Sidebar label fits on one line at the default size');
    }
    if (process.env.COCO_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_SCREENSHOT_PATH });
  });

  await t.test('compact sidebar keeps navigation, active page and profile available', async () => {
    const rail = page.locator('#rail');
    const toggle = page.locator('#sidebar');
    const expandedWidth = (await rail.boundingBox()).width;
    await button('Collapse sidebar').click();
    await page.waitForFunction(() => document.getElementById('rail').offsetWidth === 64);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await toggle.locator('use').getAttribute('href'), '#icon-expand');
    assert.equal(await button('Chat').getAttribute('aria-current'), 'page');
    if (process.env.COCO_COLLAPSED_SCREENSHOT_PATH) {
      await page.mouse.move(0, 0);
      await page.screenshot({ path: process.env.COCO_COLLAPSED_SCREENSHOT_PATH });
    }
    for (const name of ['Tasks', 'Maps', 'Devices', 'Chat']) {
      const link = page.getByTitle(name, { exact: true });
      await link.focus();
      await page.keyboard.press('Enter');
      assert.equal(await link.getAttribute('aria-current'), 'page');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    }
    await button('Alex Chen').click();
    await page.getByRole('dialog', { name: 'Your profile' }).waitFor();
    await page.keyboard.press('Escape');
    await button('Expand sidebar').focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(width => Math.abs(document.getElementById('rail').getBoundingClientRect().width - width) < 1, expandedWidth);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await toggle.locator('use').getAttribute('href'), '#icon-collapse');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'sidebar');
  });

  await t.test('suggestions, workflow menu, attachments and local conversation', async () => {
    await button('Meeting point Check where to meet').click();
    assert.equal(await message.inputValue(), 'Where is my meeting point?');
    assert.equal(await page.locator('#mode-chip').textContent(), 'Meeting point');
    await button('Chat tools').click();
    const menu = page.locator('#chat-tools');
    await menu.waitFor();
    await page.waitForFunction(() => document.activeElement.matches('[data-mode="place"]'));
    const box = await menu.boundingBox();
    const plus = await button('Chat tools').boundingBox();
    assert.ok(Math.abs(box.x - plus.x) < 2 && box.y + box.height <= plus.y);
    if (process.env.COCO_MENU_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_MENU_SCREENSHOT_PATH });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#mode-chip').textContent(), 'Device status');
    await page.locator('#mode-chip').press('Enter');
    await checkAnchoredMenu(page.locator('#mode-chip'), '#chat-tools');
    await page.keyboard.press('Escape');
    assert.equal(await message.inputValue(), 'Where is my meeting point?');
    await button('Plan a pickup Review your milk tea pickup').click();
    await message.press('Shift+Enter');
    assert.match(await message.inputValue(), /\n/);
    await message.fill('What is my current pickup plan?');
    await button('Chat tools').click();
    const chooserEvent = page.waitForEvent('filechooser');
    await button('Attach an image').click();
    await (await chooserEvent).setFiles(path.join(root, 'resources', 'robot.png'));
    await button('Remove image').waitFor();
    await message.press('Enter');
    const log = page.getByRole('log', { name: 'Conversation' });
    assert.equal(await log.locator('.user-message').textContent(), 'What is my current pickup plan?');
    assert.match(await log.locator('.reply').textContent(), /Library entrance/);
    await log.getByRole('img', { name: 'robot.png' }).waitFor();
    assert.equal(await button('Send message').isDisabled(), true);
    await page.mouse.move(0, 0);
    if (process.env.COCO_THREAD_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_THREAD_SCREENSHOT_PATH });
    await app.evaluate(({ clipboard }) => { clipboard.writeText = text => { global.copiedReply = text; }; });
    await button('Copy reply').click();
    await button('Reply copied').waitFor();
    assert.equal(await app.evaluate(() => global.copiedReply), await log.locator('.reply').textContent());
    const card = log.locator('.reply-card');
    assert.equal((await card.boundingBox()).width, (await log.locator('.turn').boundingBox()).width);
    const composerBounds = await page.locator('#chat-form').boundingBox();
    const cardBounds = await card.boundingBox();
    assert.ok(Math.abs(cardBounds.x - composerBounds.x) < 2 && Math.abs(cardBounds.width - composerBounds.width) < 2);
    await card.click();
    await page.getByRole('dialog', { name: 'Edit meeting point' }).waitFor();
    await page.keyboard.press('Escape');
    await button('Chat').click();
    assert.equal(await log.locator('.turn').count(), 1);
    await button('New chat').click();
    assert.equal(await log.count(), 0);
    await page.getByRole('heading', { name: 'How can I help on campus?' }).waitFor();
  });

  await t.test('saved conversations, archiving, reply actions and activity panel', async () => {
    const title = 'Campus pickup plan';
    const original = button(title);
    await original.click();
    await page.locator('.turn-time').click();
    await page.locator('#reply-time').waitFor();
    await checkAnchoredMenu(page.locator('.turn-time'), '#reply-time');
    assert.ok((await page.locator('#reply-time').innerText()).length > 8);
    await page.keyboard.press('Escape');
    await button('Read aloud').click();
    await button('Stop reading').click();
    await button('Read aloud').waitFor();
    await button('Rate reply').click();
    await button('Helpful').click();
    await button('Rate reply · Helpful').waitFor();
    await button('Share reply').click();
    assert.equal(await page.locator('#share-preview').textContent(), await page.locator('.reply').textContent());
    await button('Close').click();
    await button('Share conversation').click();
    const text = await page.locator('#share-preview').textContent();
    assert.match(text, /What is my current pickup plan/);
    assert.match(text, /robot.png/);
    await button('Copy text').click();
    assert.equal(await app.evaluate(() => global.copiedReply), text);
    const exportPath = path.join(profile, 'shared.txt');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, exportPath);
    await button('Save as text').click();
    await page.getByText('Text file saved.').waitFor();
    assert.equal(await readFile(exportPath, 'utf8'), text);
    await button('Close').click();
    await button('Options for ' + title).click();
    await checkConversationMenu(title);
    await button('Pin conversation').click();
    await page.locator('.history-item .icon').waitFor();
    await button('New chat').click();
    await message.fill('Is a device connected?');
    await message.press('Enter');
    await button('Device connection').waitFor();
    assert.equal(await page.locator('.history-item').first().innerText(), title);
    await button('Options for Device connection').press('Enter');
    await checkConversationMenu('Device connection');
    await button('Options for ' + title).click();
    await checkConversationMenu(title);
    await page.keyboard.press('Escape');
    await button('Options for Device connection').click();
    await checkConversationMenu('Device connection');
    await button('Archive conversation').click();
    await page.getByRole('heading', { name: 'How can I help on campus?' }).waitFor();
    assert.equal(await button('Device connection').count(), 0);
    await button('Show archived conversations').click();
    await button('Device connection').click();
    await page.getByRole('heading', { name: 'Device connection', exact: true }).waitFor();
    await button('Options for Device connection').click();
    await button('Restore conversation').click();
    await page.waitForFunction(() => !document.querySelector('#history-list .history-item'));
    await button('Show conversations').click();
    await original.click();
    const bounds = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    const before = await bounds();
    const formBefore = await page.locator('#chat-form').boundingBox();
    const railBefore = await page.locator('#rail').boundingBox();
    const shareBefore = await button('Share conversation').boundingBox();
    const toggleBefore = await page.locator('#toggle-panel').boundingBox();
    await button('Open side panel').click();
    await button('Close side panel').waitFor();
    const docked = await bounds();
    assert.ok(docked.width >= before.width + 300);
    for (const [selector, rect] of [['#chat-form', formBefore], ['#rail', railBefore], ['#share-chat', shareBefore], ['#toggle-panel', toggleBefore]]) {
      await page.waitForFunction(({ selector, rect }) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return Math.abs(box.width - rect.width) < 2 && Math.abs(box.x - rect.x) < 2;
      }, { selector, rect });
    }
    const headings = await page.evaluate(() => ['#chat-title','.panel-heading h2'].map(selector => {
      const node = document.querySelector(selector);
      return [node.getBoundingClientRect().y, getComputedStyle(node).font];
    }));
    assert.deepEqual(headings[0], headings[1]);
    const map = page.locator('.map-viewport img');
    assert.equal(await map.evaluate(img => img.complete && img.naturalWidth > 0), true);
    assert.equal(await page.locator('#run-summary').isVisible(), false);
    const frame = page.locator('.map-viewport');
    await button('Map information').click();
    await checkAnchoredMenu(button('Map information'), '#map-licence', 'right');
    await page.keyboard.press('Escape');
    const startSize = (await map.boundingBox()).width;
    await frame.hover();
    await page.mouse.wheel(0, -160);
    await page.waitForFunction(width => document.querySelector('.map-sheet').clientWidth > width * 1.2, startSize);
    const pos = await map.boundingBox();
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(pos.x + pos.width / 2 + 30, pos.y + pos.height / 2 + 20);
    await page.mouse.up({ button: 'middle' });
    assert.notEqual((await map.boundingBox()).x, pos.x);
    await frame.press('Home');
    await page.waitForFunction(width => Math.abs(document.querySelector('.map-sheet').clientWidth - width) < 2, startSize);
    if (process.env.COCO_PANEL_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_PANEL_SCREENSHOT_PATH });
    const marker = page.getByRole('img', { name: 'Active run location' });
    assert.equal(await marker.count(), 0);
    await app.evaluate(({ app }) => app.emit('workspace-activity', {
      run: { id: 'sample', name: 'Campus pickup', description: 'Library entrance', estimatedArrival: '2026-11-17T09:10:00+08:00', position: { latitude: 30.52079, longitude: 120.72156 } },
      phone: { id: 'test-phone-1', name: 'Campus iPhone', operations: ['Viewing order confirmation'] }
    }));
    await marker.waitFor();
    assert.equal(await marker.evaluate(n => n.style.left), '50%');
    await page.waitForFunction(() => {
      const frame = document.querySelector('.map-viewport');
      return document.querySelector('.map-sheet').clientWidth > Math.max(frame.clientWidth, frame.clientHeight * 2352 / 5376) * 3.9;
    });
    await app.evaluate(({ app }) => app.emit('workspace-activity', {
      run: { id: 'sample', name: 'Campus pickup', description: 'Library entrance', estimatedArrival: '2026-11-17T09:10:00+08:00', position: { latitude: 30.52179, longitude: 120.72256 } },
      phone: { id: 'test-phone-1', name: 'Campus iPhone', operations: ['Viewing order confirmation'] }
    }));
    await page.waitForFunction(() => {
      const marker = document.querySelector('#run-location');
      const point = marker.getBoundingClientRect();
      const frame = document.querySelector('.map-viewport').getBoundingClientRect();
      return parseFloat(marker.style.left) > 55 && Math.abs(point.x + point.width/2 - frame.x - frame.width/2) < 2 && Math.abs(point.y + point.height/2 - frame.y - frame.height/2) < 2;
    });
    assert.match(await page.locator('#run-eta').innerText(), /ETA /);
    await button('Share activity').click();
    assert.match(await page.locator('#share-preview').innerText(), /openstreetmap.org[\s\S]*Library entrance/);
    await page.keyboard.press('Escape');
    await frame.press('ArrowLeft');
    await button('Follow active run').click();
    await button('Show phone').click();
    await page.getByText('Viewing order confirmation').waitFor();
    await button('Share activity').click();
    assert.match(await page.locator('#share-preview').innerText(), /Campus iPhone[\s\S]*Viewing order confirmation/);
    assert.doesNotMatch(await page.locator('#share-preview').innerText(), /openstreetmap/);
    await page.keyboard.press('Escape');
    for (const name of ['Tasks','Maps','Devices','Chat']) {
      await button(name).click();
      assert.equal(await page.locator('#phone-view').isVisible(), true);
      assert.equal(await button('Close side panel').isVisible(), true);
      assert.equal((await bounds()).width, docked.width);
    }
    const phone = await page.locator('.phone-screen').boundingBox();
    assert.ok(Math.abs(phone.width / phone.height - 402 / 874) < 0.003);
    await app.evaluate(({ app }) => app.emit('workspace-activity', { run: null, phone: null }));
    await page.getByText('No phone connected', { exact: true }).waitFor();
    if (process.env.COCO_PHONE_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_PHONE_SCREENSHOT_PATH });
    await button('Show map').click();
    assert.equal(await marker.count(), 0);
    await button('Close side panel').click();
    await button('Open side panel').waitFor();
    const closedBounds = await bounds();
    assert.ok(Math.abs(closedBounds.width - before.width) <= 2 && Math.abs(closedBounds.height - before.height) <= 2);
    await message.fill('Where is my meeting point?');
    await message.press('Enter');
    await page.locator('.turn').nth(1).waitFor();
    assert.equal(await page.locator('#chat-title').textContent(), title);
    assert.equal(await page.locator('.history-item').count(), 2);
    await button('Options for Device connection').click();
    await button('Archive conversation').click();
    await page.locator('#history-list .history-item').filter({ hasText: 'Device connection' }).waitFor({ state: 'hidden' });
    await button('New chat').click();
    await page.getByRole('heading', { name: 'How can I help on campus?' }).waitFor();
  });

  await t.test('keyboard editing, draft preview and voice typing handoff', async () => {
    await button('Chat tools').focus();
    await page.keyboard.press('Enter');
    await button('Edit meeting point').click();
    assert.equal(await meeting.inputValue(), 'Library entrance');
    await meeting.fill('   ');
    await meeting.press('Enter');
    assert.equal(await meeting.getAttribute('aria-invalid'), 'true');
    await meeting.fill('Library north entrance');
    await meeting.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Save meeting point');
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'Meeting point' }).waitFor();
    assert.equal(await page.locator('#preview-value').textContent(), 'Library north entrance');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.locator(':focus').getAttribute('id'), 'tools');
    // Substitute only the audio source. The real IPC, subprocess protocol and draft editing stay active.
    await app.evaluate(() => {
      const processes = process.getBuiltinModule('child_process');
      const spawn = processes.spawn;
      global.restoreAudio = () => { processes.spawn = spawn; };
      processes.spawn = (file, args, opts) => {
        const script = Buffer.from(args.at(-1), 'base64').toString('utf16le');
        if (!script.includes('[CoCoDictation]::Listen')) return spawn(file, args, opts);
        let source = "[Console]::WriteLine('ready en-US'); [void][Console]::ReadLine(); [Console]::WriteLine('text Y2FtcHVz')";
        if (global.waveSample) source = script.replace('[CoCoDictation]::Listen($WaveFile)', "[CoCoDictation]::Listen('" + global.waveSample.replaceAll("'","''") + "')");
        return spawn(file, [...args.slice(0,-1),Buffer.from(source, 'utf16le').toString('base64')], opts);
      };
    });
    try {
      await message.fill('Meet here');
      await message.evaluate(el => el.setSelectionRange(5,9));
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
      await button('Voice input').click();
      await page.locator('#voice-status').filter({ hasText: 'Listening' }).waitFor();
      await button('Stop dictation').click();
      await page.waitForFunction(() => document.querySelector('#message').value === 'Meet campus');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'message');
      await button('Voice input').click();
      await button('Tasks').click();
      await button('Chat').click();
      assert.equal(await button('Voice input').isEnabled(), true);
      assert.equal(await message.inputValue(), 'Meet campus');
      if (process.env.COCO_TEST_DICTATION_WAV) {
        await app.evaluate((_, file) => { global.waveSample = file; }, process.env.COCO_TEST_DICTATION_WAV);
        await message.fill('');
        await button('Voice input').click();
        await page.waitForFunction(() => document.querySelector('#message').value === '今天天气很好');
      }
    } finally {
      await app.evaluate(() => global.restoreAudio());
      await message.fill('');
    }
  });

  await t.test('sidebar pages, draft continuity, history, profile and iPhone handoff', async () => {
    await button('Tasks').click();
    await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
    assert.equal(await page.getByText('Current draft', {exact: true}).count(), 0);
    await button('Chat').click();
    await button('Chat tools').click();
    await button('Order on iPhone').click();
    await page.getByRole('dialog', { name: 'Order on iPhone' }).waitFor();
    await button('Close').click();
    await button('Tasks').click();
    await button('Maps').click();
    await button('Back').click();
    await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
    await page.keyboard.press('Alt+ArrowRight');
    await page.getByRole('heading', { name: 'Maps' }).waitFor();
    await page.keyboard.press('Alt+ArrowLeft');
    await page.locator('nav button[data-page="devices"]').click();
    assert.equal(await button('Forward').isDisabled(), true);
    await page.getByRole('heading', { name: 'Paired devices' }).waitFor();
    await button('Alex Chen').click();
    await page.getByRole('dialog', { name: 'Your profile' }).waitFor();
    await button('Close').click();
    await button('Chat').click();
    await message.fill('Where is my meeting point?');
    await message.press('Enter');
    assert.match(await page.locator('.reply').textContent(), /Library north entrance/);
  });

  await t.test('desktop menus and keyboard shortcuts', async () => {
    const menuItem = name => page.getByRole('menuitem', { name });
    await menuItem('File').click();
    await page.getByRole('menu', { name: 'File' }).waitFor();
    const fileButton = await menuItem('File').boundingBox();
    const popup = await page.locator('#command-menu').boundingBox();
    assert.ok(popup.y >= fileButton.y + fileButton.height && Math.abs(popup.x - fileButton.x) < 2);
    if (process.env.COCO_FILE_MENU_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_FILE_MENU_SCREENSHOT_PATH });
    await page.keyboard.press('ArrowRight');
    await page.getByRole('menu', { name: 'Edit' }).waitFor();
    await page.keyboard.press('Escape');
    await page.keyboard.press('F1');
    await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor();
    await page.keyboard.press('Escape');
    await message.fill('');
    await message.pressSequentially('campus');
    await page.keyboard.press('Alt+e');
    await menuItem(/^Undo/).click();
    await page.waitForFunction(() => document.querySelector('#message').value === '');
  });
  await t.test('task instructions, demo reruns and historical flight playback', async () => {
    await button('Tasks').click();
    assert.equal(await page.locator('#activity-panel').isHidden(), true);
    assert.equal(await page.locator('main #route-drawing').count(), 0);
    const tracked = page.locator('.run-row').filter({ hasText: 'Campus pickup' });
    await tracked.getByRole('button', { name: 'View task details' }).click();
    assert.deepEqual(await page.locator('.task-timeline li span').allTextContents(), ['Running', 'Ended']);
    assert.equal(await page.locator('#inspect-demo').isHidden(), true);
    await tracked.getByRole('button', { name: 'View flight path' }).click();
    await page.getByRole('img', {name: /^Recorded flight path/}).waitFor();
    const sample = page.locator('[data-id="example-tea"]');
    await sample.getByRole('button', {name: 'View flight path'}).press('Enter');
    await page.getByRole('img', {name: /Demo flight path from Student Center to Library entrance/}).waitFor();
    assert.equal(await page.locator('#route-basemap').getAttribute('href'), 'haining-campus.svg');
    assert.equal(await page.locator('#activity-panel #route-drawing').isVisible(), true);
    await page.locator('#route-credits').press('Enter');
    await checkAnchoredMenu(page.locator('#route-credits'), '#map-library-credits', 'right');
    await page.keyboard.press('Escape');
    await button('Close task panel').click();
    await button('Open side panel').waitFor();
    assert.equal(await page.locator('#task-list').isVisible(), true);
    await button('Open side panel').click();
    await page.getByRole('img', {name: /Demo flight path from Student Center to Library entrance/}).waitFor();
    await button('Play route').click();
    await page.waitForFunction(() => +document.querySelector('#route-progress').value > 60);
    await button('Pause route').click();
    await page.locator('#route-progress').press('End');
    assert.equal(await page.locator('#route-time').textContent(), '4:00');
    await sample.getByRole('button', {name: 'View task details'}).click();
    const command = await page.locator('#task-instruction').textContent();
    const count = await page.locator('.run-row').count();
    await sample.getByRole('button', {name: 'Run again in demo'}).press('Enter');
    await page.waitForFunction(n => document.querySelectorAll('.run-row').length === n+1, count);
    const repeat = page.locator('.run-row.selected');
    assert.notEqual(await repeat.getAttribute('data-id'), 'example-tea');
    assert.equal(await repeat.locator('strong').innerText(), 'Milk tea pickup');
    await button('Task details').click();
    assert.equal(await page.locator('#task-instruction').textContent(), command);
    assert.equal(await page.locator('#inspect-demo').isVisible(), true);
    assert.equal(await page.locator('#run-location').isHidden(), true);
    await sample.getByRole('button', {name: 'View flight path'}).click();
    if (process.env.COCO_TASKS_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_TASKS_SCREENSHOT_PATH });
  });
  await t.test('numbered campus map pages and local map imports', async () => {
    await button('Maps').click();
    await button('Open side panel').waitFor();
    if (await button('Maximize').isVisible()) await button('Maximize').click();
    await waitWindowState(app, 'isMaximized', true);
    await page.waitForFunction(() => document.querySelectorAll('.map-card').length === 12);
    await button('Haining International Campus').waitFor();
    await checkSidebarAlignment();
    const grid = await page.locator('.map-card').evaluateAll(cards => cards.map(card => {
      const {x,y,bottom} = card.getBoundingClientRect();
      const label = card.querySelector('strong');
      return { x,y,bottom, fits: label.scrollWidth <= label.clientWidth, lines: getComputedStyle(label).whiteSpace };
    }));
    assert.equal(grid.length, 12);
    assert.equal(new Set(grid.map(card => card.x)).size, 4);
    assert.equal(new Set(grid.map(card => card.y)).size, 3);
    await checkMapsFit();
    assert.ok(grid.every(card => card.fits && card.lines === 'nowrap'));
    assert.ok(await page.evaluate(() => Math.abs(document.querySelector('.map-card').getBoundingClientRect().x -
      document.querySelector('#maps-heading').getBoundingClientRect().x) < 2));
    assert.ok(grid.at(-1).bottom <= await page.locator('main').evaluate(el => el.getBoundingClientRect().bottom));
    if (process.env.COCO_MAPS_GRID_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_MAPS_GRID_SCREENSHOT_PATH });
    const covers = await page.locator('.map-card img').evaluateAll(images => images.map(image => image.src));
    assert.equal(new Set(covers).size, 12);
    assert.deepEqual(await page.locator('#map-pages button').allTextContents(), ['1','2','3','4']);
    assert.equal(await page.getByText('Campus maps © OpenStreetMap contributors').count(), 0);
    await button('Map credits').click();
    await button('Open data licence').waitFor();
    await checkAnchoredMenu(button('Map credits'), '#map-library-credits', 'right');
    await page.keyboard.press('Escape');
    const allCovers = new Set(covers);
    for (let n = 2; n <= 4; n++) {
      await page.waitForFunction(() => document.querySelector('#activity-panel').hidden && document.querySelectorAll('.map-card').length === 12);
      await button('Page ' + n).press('Enter');
      assert.equal(await button('Page ' + n).getAttribute('aria-current'), 'page');
      const images = page.locator('.map-card img');
      assert.equal(await images.count(), 12);
      await checkMapsFit();
      for (const url of await images.evaluateAll(imgs => Promise.all(imgs.map(async img => {
        await img.decode();
        return img.src;
      })))) allCovers.add(url);
      const card = page.locator('.map-card').first();
      const src = await card.locator('img').getAttribute('src');
      await card.click();
      assert.equal(await page.locator('.map-sheet img').getAttribute('src'), src.replace(/\.webp$/, '.svg'));
      await button('Close side panel').click();
    }
    assert.equal(allCovers.size, 48);
    await page.evaluate(async () => {
      for (const campus of campusMaps) {
        const image = new Image();
        image.src = campusBasemap(campus);
        await image.decode();
        if (image.naturalWidth / image.naturalHeight !== (campus.aspect || 1)) throw new Error(campus.name + ' extent mismatch');
      }
    });
    if (process.env.COCO_MAP_PAGES_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_MAP_PAGES_SCREENSHOT_PATH });
    await button('Page 1').click();
    const firstPageNames = await page.locator('.map-card').evaluateAll(cards => cards.map(card => card.title));
    for (const label of firstPageNames) {
      const card = button(label);
      const cover = await card.locator('img').getAttribute('src');
      await card.click();
      await button('Close side panel').waitFor();
      const map = page.locator('.map-sheet img');
      await map.evaluate(image => image.decode());
      assert.equal(await map.getAttribute('src'), cover.replace(/\.webp$/, '.svg'));
      assert.equal(await map.getAttribute('alt'), label);
      if (label !== firstPageNames.at(-1)) {
        await button('Close side panel').click();
        await page.waitForFunction(() => document.querySelectorAll('.map-card').length === 12 && document.querySelector('#activity-panel').hidden);
      }
    }
    await button('Share activity').click();
    assert.match(await page.locator('#share-preview').innerText(), /Yungu Campus[\s\S]*30\.33600\/120\.03200/);
    await page.keyboard.press('Escape');
    await button('Close side panel').click();
    await button('Page 1').click();
    await button('Haining International Campus').click();
    await page.getByRole('heading', {name: 'Maps', exact: true}).waitFor();
    if (process.env.COCO_MAPS_PANEL_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_MAPS_PANEL_SCREENSHOT_PATH });
    await button('Close side panel').click();
    const sketch = await readFile(path.join(root, 'src', 'ui', 'haining-campus.webp'));
    assert.equal(await button('Add map…').innerText(), '');
    const chooserEvent = page.waitForEvent('filechooser');
    await button('Add map…').press('Enter');
    await (await chooserEvent).setFiles({ name: 'Campus sketch.webp', mimeType: 'image/webp', buffer: sketch });
    await button('Campus sketch').click();
    await page.getByRole('dialog', { name: 'Campus sketch' }).waitFor();
    await page.keyboard.press('Escape');
  });
  await t.test('paired devices and native Bluetooth settings', async () => {
    await button('Devices').click();
    await page.locator('#device-list').getByText('Campus iPhone', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('#refresh-devices').disabled);
    assert.equal(await page.locator('#device-status').innerText(), '');
    await app.evaluate(({ shell }) => { shell.openExternal = async url => { global.settingsUrl = url; }; });
    for (const name of ['Refresh','Pair a device…']) {
      const action = button(name);
      assert.equal(await action.innerText(), '');
      assert.equal(await action.getAttribute('title'), name);
      assert.equal(await action.locator('svg use').count(), 1);
    }
    await button('Refresh').press('Enter');
    await page.waitForFunction(() => !document.querySelector('#refresh-devices').disabled);
    await button('Pair a device…').press('Enter');
    assert.equal(await app.evaluate(() => global.settingsUrl), 'ms-settings:bluetooth');
    await button('Chat').click();
  });

  await t.test('native maximize, restore, minimize and minimum window layout', async () => {
    if (await button('Restore').isVisible()) await button('Restore').click();
    const normal = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    await button('Open side panel').click();
    await button('Close side panel').waitFor();
    await button('Maximize').click();
    await waitWindowState(app, 'isMaximized', true);
    await page.waitForFunction(() => document.querySelector('.shell').dataset.panel === 'docked');
    async function maximizedLayout() {
      return page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect();
        const rail = box('#rail'), main = box('#main'), panel = box('#activity-panel'), form = box('#chat-form');
        return { rail: rail.width, workspace: main.width, panel: panel.width,
          adjacent: Math.abs(main.right - panel.left) <= 1,
          centered: Math.abs((form.left - main.left) - (main.right - form.right)) <= 2 };
      });
    }
    await page.waitForFunction(() => document.documentElement.classList.contains('maximized')
      && document.getElementById('rail').getAnimations().every(animation => animation.playState !== 'running'));
    const docked = await maximizedLayout();
    assert.ok(docked.rail <= 264 && docked.adjacent && docked.centered, JSON.stringify(docked));
    await button('Close side panel').click();
    await button('Open side panel').waitFor();
    const closed = await maximizedLayout();
    assert.ok(closed.centered && Math.abs(closed.workspace - docked.workspace - docked.panel) <= 2,
      JSON.stringify({ docked, closed }));
    await button('Open side panel').click();
    await button('Close side panel').waitFor();
    const reopened = await maximizedLayout();
    assert.ok(reopened.adjacent && reopened.centered && Math.abs(reopened.rail - closed.rail) <= 1);
    await button('Close side panel').press('Escape');
    await button('Open side panel').waitFor();
    await button('Restore').click();
    await waitWindowState(app, 'isMaximized', false);
    const restored = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    assert.ok(Math.abs(restored.width - normal.width) <= 2);
    await button('Minimize').click();
    await waitWindowState(app, 'isMinimized', true);
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.restore();
      win.setSize(620, 460);
    });
    await page.waitForFunction(() => window.innerWidth <= 620);
    assert.equal(await page.locator('main').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    await button('Tasks').click();
    await page.locator('[data-id="example-book"]').getByRole('button', {name: 'View flight path'}).click();
    await page.getByRole('img', {name: /from Residences to Library entrance/}).waitFor();
    assert.equal(await page.locator('main').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    await button('Maps').click();
    await page.waitForFunction(() => window.innerWidth <= 620 && document.querySelector('#activity-panel').hidden);
    await button('Page 1').click();
    await button('Page 3').click();
    assert.equal(await page.locator('main').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    assert.equal(await page.locator('.map-card').evaluateAll(cards => new Set(cards.map(c => c.getBoundingClientRect().y)).size), 3);
    await checkMapsFit();
    await page.evaluate(() => window.coco.control('zoom-in'));
    await page.waitForFunction(() => window.innerWidth < 610);
    await checkMapsFit();
    await page.evaluate(() => window.coco.control('zoom-reset'));
    await button('Chat').click();
    await page.keyboard.press('Control+=');
    await page.waitForFunction(() => window.innerWidth < 610);
    assert.equal(await page.locator('main').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    await page.keyboard.press('Control+0');
    await button('New chat').click();
    const form = page.locator('#chat-form');
    assert.equal(await form.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    await button('Chat tools').click();
    await button('Edit meeting point').click();
    await button('Save meeting point').click();
    await button('Close').click();
  });

  await t.test('native close exits and a fresh process starts with a new draft', async () => {
    const closed = app.waitForEvent('close');
    await button('Close window').click({ noWaitAfter: true }).catch(error => {
      if (!error.message.includes('has been closed')) throw error;
    });
    await closed;
    app = null;
    app = await launch();
    const fresh = await app.firstWindow();
    await fresh.getByRole('heading', { name: 'How can I help on campus?' }).waitFor();
    assert.equal(await fresh.locator('.turn').count(), 0);
    await fresh.getByRole('button', { name: 'Campus pickup plan', exact: true }).click();
    await fresh.getByRole('button', { name: 'Rate reply · Helpful', exact: true }).waitFor();
    await fresh.waitForFunction(() => document.querySelector('.user-image')?.naturalWidth > 0);
    assert.equal(await fresh.locator('.turn').count(), 2);
    assert.equal(await fresh.locator('.history-item .icon').count(), 1);
    await fresh.getByRole('button', { name: 'Show archived conversations' }).click();
    await fresh.getByRole('button', { name: 'Device connection', exact: true }).waitFor();
    await fresh.getByRole('button', { name: 'Tasks', exact: true }).click();
    assert.equal(await fresh.locator('#activity-panel').isHidden(), true);
    await fresh.locator('.run-row').filter({ hasText: 'Campus pickup' }).waitFor();
    assert.equal(await fresh.locator('.run-row').filter({hasText: 'Milk tea pickup'}).count(), 2);
    await fresh.locator('.run-row').filter({hasText: 'Milk tea pickup'}).first().getByRole('button', {name:'View task details'}).click();
    await fresh.locator('#task-events').getByText('Completed').waitFor();
    await fresh.getByRole('button', { name: 'Maps', exact: true }).click();
    await fresh.getByRole('button', { name: 'Open side panel', exact: true }).waitFor();
    if (await fresh.getByRole('button', { name: 'Maximize', exact: true }).isVisible()) {
      await fresh.getByRole('button', { name: 'Maximize', exact: true }).click();
    }
    await fresh.waitForFunction(() => document.querySelectorAll('#map-pages button').length === 5);
    await fresh.getByRole('button', { name: 'Page 5', exact: true }).click();
    await fresh.getByRole('button', { name: 'Campus sketch', exact: true }).waitFor();
    await fresh.getByRole('button', { name: 'Campus sketch', exact: true }).click();
    await fresh.getByRole('button', { name: 'Remove from Maps' }).click();
    await fresh.waitForFunction(() => document.querySelector('#map-pages [aria-current]')?.textContent === '4');
    assert.equal(await fresh.locator('#map-pages button').count(), 4);
    await fresh.getByRole('button', { name: 'Devices', exact: true }).click();
    await fresh.locator('#device-list').getByText('Campus iPhone', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  });
  await t.test('upgrade a version-one conversation store without losing its messages', async () => {
    const fresh = await app.firstWindow();
    const fixture = 'coco-upgrade-fixture';
    await fresh.evaluate(name => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        const chats = request.result.createObjectStore('chats', { keyPath: 'id' });
        const turns = request.result.createObjectStore('turns', { keyPath: ['chatId','index'] });
        chats.put({ id: 'old', title: 'Earlier conversation', pinned: true, archived: false, updated: 1000 });
        turns.put({ chatId: 'old', index: 0, text: 'Previous message', reply: { text: 'Previous reply' }, created: 1000, rating: 'helpful' });
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    }), fixture);
    await fresh.addInitScript(name => {
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function(database, ...args) {
        return open.call(this, database === 'coco-conversations' ? name : database, ...args);
      };
    }, fixture);
    await fresh.reload();
    await fresh.getByRole('button', { name: 'Earlier conversation', exact: true }).click();
    await fresh.getByText('Previous reply', { exact: true }).waitFor();
    await fresh.getByRole('button', { name: 'Rate reply · Helpful' }).waitFor();
    await fresh.getByRole('button', { name: 'Maps', exact: true }).click();
    await fresh.getByRole('button', { name: 'Haining International Campus' }).waitFor();
  });
});
