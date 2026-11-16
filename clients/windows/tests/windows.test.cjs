const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
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
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('#display-name').filter({ hasText: 'Alex Chen' }).waitFor();

  await t.test('offline artwork, fonts and the approved starting screen', async () => {
    await page.getByRole('heading', { name: 'Set a meeting point' }).waitFor();
    assert.equal(await meeting.inputValue(), 'Library entrance');
    assert.equal(await button('Back').isDisabled(), true);
    assert.equal(await button('Forward').isDisabled(), true);
    const ready = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.images].every(image => image.complete && image.naturalWidth > 0)
        && document.fonts.check('800 18px Nunito') && document.fonts.check('400 16px Noto')
        && getComputedStyle(document.body).backgroundColor === 'rgb(242, 242, 244)';
    });
    assert.equal(ready, true);
    for (const selector of ['nav [data-page="places"] span', 'nav small']) {
      const lines = await page.locator(selector).evaluate(n => {
        const range = document.createRange();
        range.selectNodeContents(n);
        return range.getClientRects().length;
      });
      assert.equal(lines, 1, 'Sidebar label fits on one line at the default size');
    }
    if (process.env.COCO_SCREENSHOT_PATH) await page.screenshot({ path: process.env.COCO_SCREENSHOT_PATH });
  });

  await t.test('Tab and Enter open and dismiss the draft preview', async () => {
    await meeting.fill('   ');
    await meeting.press('Enter');
    assert.equal(await meeting.getAttribute('aria-invalid'), 'true');
    await meeting.fill('Library north entrance');
    await meeting.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'voice');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Save meeting point');
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'Meeting point' }).waitFor();
    assert.equal(await page.locator('#preview-value').textContent(), 'Library north entrance');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.locator(':focus').textContent(), 'Save meeting point');
    await button('Voice input').click();
    await button('Type instead').click();
    assert.equal(await page.locator(':focus').getAttribute('id'), 'meeting');
  });

  await t.test('sidebar pages, draft continuity, history, profile and iPhone handoff', async () => {
    await button('Tasks').click();
    await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
    assert.equal(await page.locator('[data-view="tasks"] dd').textContent(), 'Library north entrance');
    await button('Order on iPhone').click();
    await page.getByRole('dialog', { name: 'Order on iPhone' }).waitFor();
    await button('Close').click();
    await button('Places & routes').click();
    await button('Back').click();
    await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
    await page.keyboard.press('Alt+ArrowRight');
    await page.getByRole('heading', { name: 'Places & routes' }).waitFor();
    await page.keyboard.press('Alt+ArrowLeft');
    await page.locator('nav button[data-page="devices"]').click();
    assert.equal(await button('Forward').isDisabled(), true);
    await page.getByRole('heading', { name: 'No device connected' }).waitFor();
    await button('Hide sidebar').click();
    assert.equal(await page.locator('#rail').isVisible(), false);
    await button('Show sidebar').click();
    await button('Alex Chen').click();
    await page.getByRole('dialog', { name: 'Your profile' }).waitFor();
    await button('Close').click();
    await button('Chat').click();
    assert.equal(await meeting.inputValue(), 'Library north entrance');
  });

  await t.test('native maximize, restore, minimize and minimum window layout', async () => {
    if (await button('Restore').isVisible()) await button('Restore').click();
    await button('Maximize').click();
    await waitWindowState(app, 'isMaximized', true);
    await button('Restore').click();
    await waitWindowState(app, 'isMaximized', false);
    await button('Minimize').click();
    await waitWindowState(app, 'isMinimized', true);
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.restore();
      win.setSize(620, 460);
    });
    await page.waitForFunction(() => window.innerWidth <= 620);
    assert.equal(await page.locator('main').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    await page.keyboard.press('Control+=');
    await page.waitForFunction(() => window.innerWidth < 610);
    assert.equal(await page.locator('main').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    await page.keyboard.press('Control+0');
    await button('Save meeting point').click();
    await button('Close').click();
  });

  await t.test('native close exits and a fresh process starts with a new draft', async () => {
    const closed = app.waitForEvent('close');
    await button('Close window').click();
    await closed;
    app = null;
    app = await launch();
    const fresh = await app.firstWindow();
    const input = fresh.getByRole('textbox', { name: 'Meeting point' });
    await input.waitFor();
    assert.equal(await input.inputValue(), 'Library entrance');
    assert.deepEqual(errors, []);
  });
});
