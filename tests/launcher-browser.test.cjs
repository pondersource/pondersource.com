// Run against the local static server. See README.md for Playwright setup.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LAUNCHER_TEST_URL || 'http://127.0.0.1:8000';
let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); });

async function open(t, options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'no uncaught browser errors'));
  // Launching an app is tested without contacting the external application.
  await context.route('https://*.pondersource.com/**', route => route.fulfill({ body: 'Test app' }));
  return { context, page };
}
async function localReady(page) {
  await page.waitForFunction(() => document.querySelector('#storage-status').textContent.includes('saved on this device'));
}
async function install(page, id) {
  await page.getByRole('tab', { name: 'App store' }).click();
  await page.locator('#store-panel [data-app-id="' + id + '"] .install-app').click();
  await page.waitForFunction(id => document.querySelector('#store-panel [data-app-id="' + id + '"] .install-app').textContent === 'Installed', id);
}
async function library(page) {
  await page.getByRole('tab', { name: /My apps/ }).click();
}
async function waitFor(fn) {
  const deadline = Date.now() + 10000;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for storage sync');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function remoteFixture(context, initial, fixture = { data: initial, puts: 0, fail: false, revision: 1, authScopes: [] }) {
  return context.route('https://storage.example/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'Access-Control-Allow-Origin': new URL(base).origin,
      'Access-Control-Allow-Headers': 'authorization,content-type,if-match,if-none-match',
      'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'ETag,Content-Type', ETag: '"' + fixture.revision + '"'
    };
    if (url.pathname.startsWith('/.well-known/')) return route.fulfill({ headers, json: { links: [{
      rel: 'remotestorage', href: 'https://storage.example/storage/alice/', properties: {
        'http://remotestorage.io/spec/version': 'draft-dejong-remotestorage-03',
        'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://storage.example/oauth'
      }
    }] } });
    if (url.pathname === '/oauth') {
      fixture.authScopes.push(url.searchParams.get('scope'));
      return route.fulfill({ status: 302, headers: {
        location: url.searchParams.get('redirect_uri') + '#access_token=fixture-token&token_type=bearer&scope=launcher%3Arw&state=' + encodeURIComponent(url.searchParams.get('state') || '')
      } });
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    if (fixture.fail) return route.fulfill({ status: 500, headers });
    if (request.method() === 'PUT') {
      assert.equal(request.headers().authorization, 'Bearer fixture-token');
      fixture.data = JSON.parse(request.postData());
      fixture.puts++;
      fixture.revision++;
      return route.fulfill({ status: 201, headers: { ...headers, ETag: '"' + fixture.revision + '"' } });
    }
    if (url.pathname.endsWith('/')) return route.fulfill({ headers, json: {
      '@context': 'http://remotestorage.io/spec/folder-description',
      items: fixture.data ? { 'installed-apps': { ETag: String(fixture.revision), 'Content-Type': 'application/json' } } : {}
    } });
    return fixture.data ? route.fulfill({ headers, json: fixture.data }) : route.fulfill({ status: 404, headers });
  }).then(() => fixture);
}
async function connect(page) {
  await page.locator('#rs-user-address').fill('alice@storage.example');
  await page.locator('#rs-connect-btn').click();
  await page.waitForFunction(() => document.querySelector('#storage-status').textContent.includes('connected to remoteStorage'));
}

test('real OPFS: install, reload, launch, recent apps, remove, keyboard navigation and mobile layout', async t => {
  const { context, page } = await open(t, { viewport: { width: 390, height: 844 } });
  await page.goto(base + '/#remotestorage=alice%40storage.example');
  await localReady(page);
  assert.equal(await page.locator('#rs-user-address').inputValue(), 'alice@storage.example');
  assert.equal(new URL(page.url()).hash, '');
  assert.equal(await page.getByRole('link', { name: 'Launch Litewrite' }).count(), 0);
  await page.locator('#browse-apps').click();
  await install(page, 'litewrite');
  await page.reload();
  await localReady(page);
  assert.equal(await page.locator('#installed-count').textContent(), '(1)');
  const file = await page.evaluate(async () => JSON.parse(await (await (await (await navigator.storage.getDirectory()).getFileHandle('pondersource-launcher-v1.json')).getFile()).text()));
  assert.equal(file.apps[0].id, 'litewrite');
  const popupReady = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Launch Litewrite', exact: true }).click();
  const popup = await popupReady;
  await popup.waitForLoadState();
  assert.equal(new URL(popup.url()).origin, 'https://litewrite.pondersource.com');
  await popup.close();
  await page.waitForFunction(() => !document.querySelector('#recent-apps').hidden);
  await page.reload();
  await localReady(page);
  assert.equal(await page.locator('#recent-list a').count(), 1);
  await page.getByRole('button', { name: 'Remove Litewrite from your launcher' }).click();
  await page.waitForFunction(() => document.querySelector('#installed-count').textContent === '(0)');
  await page.reload();
  await localReady(page);
  assert.equal(await page.locator('#recent-list a').count(), 0);
  assert.equal(await page.locator('#empty-library').isVisible(), true);
  await page.getByRole('tab', { name: /My apps/ }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'App store' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('browser-storage fallback persists installs without OPFS', async t => {
  const { context, page } = await open(t);
  await context.addInitScript(() => Object.defineProperty(navigator.storage, 'getDirectory', { value: undefined }));
  await page.goto(base);
  await localReady(page);
  await install(page, 'inbox-rs');
  await page.reload();
  await localReady(page);
  assert.equal(await page.getByRole('link', { name: 'Launch Inbox RS' }).count(), 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pondersource:launcher:v1')).apps[0].id), 'inbox-rs');
});

test('corrupt OPFS is not overwritten and can be retried after repair', async t => {
  const { page } = await open(t);
  await page.goto(base);
  await localReady(page);
  await page.evaluate(async () => {
    const file = await (await navigator.storage.getDirectory()).getFileHandle('pondersource-launcher-v1.json', { create: true });
    const writer = await file.createWritable();
    await writer.write('{broken');
    await writer.close();
  });
  await page.reload();
  await page.locator('#library-error').waitFor({ state: 'visible' });
  const contents = await page.evaluate(async () => (await (await (await navigator.storage.getDirectory()).getFileHandle('pondersource-launcher-v1.json')).getFile()).text());
  assert.equal(contents, '{broken');
  await page.getByRole('tab', { name: 'App store' }).click();
  assert.equal(await page.locator('.install-app:disabled').count(), 3);
  await page.evaluate(async () => (await navigator.storage.getDirectory()).removeEntry('pondersource-launcher-v1.json'));
  await page.locator('#retry-library').click();
  await localReady(page);
  await install(page, 'hyperdraft');
});

test('concurrent tabs retain independent installs', async t => {
  const { context, page } = await open(t);
  const second = await context.newPage();
  await Promise.all([page.goto(base), second.goto(base)]);
  await Promise.all([localReady(page), localReady(second)]);
  await Promise.all([install(page, 'litewrite'), install(second, 'hyperdraft')]);
  await page.reload();
  await localReady(page);
  assert.equal(await page.locator('#installed-count').textContent(), '(2)');
});

test('real remoteStorage.js: authorize, load account library, copy device apps, sync, reload and isolate sign-out', async t => {
  const { context, page } = await open(t);
  const fixture = await remoteFixture(context, { version: 1, apps: [{ id: 'hyperdraft', installed: true, updatedAt: 100, lastOpened: 0 }] });
  await page.goto(base);
  await localReady(page);
  await install(page, 'litewrite');
  await connect(page);
  assert.deepEqual(fixture.authScopes, ['launcher:rw']);
  assert.equal(await page.getByRole('link', { name: 'Launch Hyperdraft' }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Launch Litewrite' }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Launch Hyperdraft' }).getAttribute('href'), 'https://hyperdraft.pondersource.com#remotestorage=alice%40storage.example');
  assert.equal(fixture.puts, 0, 'connecting does not overwrite the remote library');
  await page.locator('#copy-device-apps').click();
  await waitFor(() => fixture.data.apps.some(app => app.id === 'litewrite' && app.installed));
  assert.equal(await page.locator('#installed-count').textContent(), '(2)');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#storage-status').textContent.includes('connected to remoteStorage'));
  assert.equal(await page.locator('#installed-count').textContent(), '(2)');
  const otherDevice = await open(t);
  await remoteFixture(otherDevice.context, undefined, fixture);
  await otherDevice.page.goto(base);
  await localReady(otherDevice.page);
  await connect(otherDevice.page);
  assert.equal(await otherDevice.page.locator('#installed-count').textContent(), '(2)', 'a fresh device reads the synced library');
  await page.getByRole('button', { name: 'Remove Hyperdraft from your launcher' }).click();
  await waitFor(() => fixture.data.apps.some(app => app.id === 'hyperdraft' && !app.installed));
  await page.locator('#rs-disconnect-btn').click();
  await localReady(page);
  assert.equal(await page.locator('#installed-count').textContent(), '(1)');
  assert.equal(await page.getByRole('link', { name: 'Launch Litewrite' }).getAttribute('href'), 'https://litewrite.pondersource.com');
  await connect(page);
  assert.equal(await page.locator('#installed-count').textContent(), '(1)');
  assert.equal(await page.getByRole('link', { name: 'Launch Hyperdraft' }).count(), 0);
});

test('invalid remote library blocks writes instead of resetting account data', async t => {
  const { context, page } = await open(t);
  const fixture = await remoteFixture(context, { version: 99, apps: [] });
  await page.goto(base);
  await localReady(page);
  await page.locator('#rs-user-address').fill('alice@storage.example');
  await page.locator('#rs-connect-btn').click();
  await page.locator('#library-error').waitFor({ state: 'visible' });
  assert.match(await page.locator('#library-error').textContent(), /format/);
  assert.equal(fixture.puts, 0);
  await page.getByRole('tab', { name: 'App store' }).click();
  assert.equal(await page.locator('.install-app:disabled').count(), 3);
  await page.locator('#rs-disconnect-btn').click();
  await localReady(page);
});

for (const [provider, label, host] of [['googledrive', 'Google Drive', 'accounts.google.com'], ['dropbox', 'Dropbox', 'www.dropbox.com']]) {
  test('configured ' + label + ' uses the bundled OAuth backend', async t => {
    const { context, page } = await open(t);
    await context.route('**/assets/js/launcher-config.mjs', route => route.fulfill({ contentType: 'text/javascript', body: 'export const storageApiKeys = { ' + provider + ': "public-test-client-id" };' }));
    let authorization;
    await context.route('https://' + host + '/**', route => {
      authorization = new URL(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: '<p>Provider authorization fixture</p>' });
    });
    await page.goto(base);
    await localReady(page);
    await page.getByRole('button', { name: 'Connect ' + label }).click();
    await waitFor(() => authorization);
    assert.equal(authorization.searchParams.get('client_id'), 'public-test-client-id');
    assert.equal(new URL(authorization.searchParams.get('redirect_uri')).href, new URL(base).origin + '/');
    if (provider === 'dropbox') assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    else assert.match(authorization.searchParams.get('scope'), /drive/);
  });
}
