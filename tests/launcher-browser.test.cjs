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

test('registered Google Drive and Dropbox providers remain available', async t => {
  const { page } = await open(t);
  await page.goto(base);
  await localReady(page);
  assert.ok(await page.getByRole('button', { name: 'Google Drive', exact: true }).isVisible());
  assert.ok(await page.getByRole('button', { name: 'Dropbox', exact: true }).isVisible());
});
async function install(page, id) {
  await page.getByRole('tab', { name: 'App store' }).click();
  await page.locator('#store-panel [data-app-id="' + id + '"] .install-app').click();
  await page.waitForFunction(id => document.querySelector('#store-panel [data-app-id="' + id + '"] .install-app').textContent === 'Installed', id);
}
async function library(page) {
  await page.getByRole('tab', { name: /My apps/ }).click();
}

test('the app-owned guest archive transfers the local library and blocks connection until export', async t => {
  const { page } = await open(t);
  await page.goto(base);
  await localReady(page);
  await install(page, 'webmarks');
  await page.locator('.rs-choose-nextgraph').click();
  assert.equal(await page.locator('[name=rs-nextgraph-wallet]').inputValue(), 'https://nextgraph.net');
  await page.locator('.rs-nextgraph-connect').click();
  await page.waitForFunction(() => document.querySelector('.rs-nextgraph-error').textContent.includes('Export your app library'));
  assert.match(await page.locator('.rs-nextgraph-error').innerText(), /Export your app library/);
  await page.locator('.rs-nextgraph-back').click();
  assert.equal(new URL(page.url()).origin, new URL(base).origin);
  const downloading = page.waitForEvent('download');
  await page.locator('.rs-export-guest').click();
  const downloaded = await downloading;
  assert.equal(downloaded.suggestedFilename(), 'pondersource-app-library.json');
  const bytes = await require('node:fs/promises').readFile(await downloaded.path());
  const saved = JSON.parse(bytes);
  assert.equal(saved.version, 1);
  assert.equal(saved.apps.find(app => app.id === 'webmarks').installed, true);
  const second = (await open(t)).page;
  await second.goto(base);
  await localReady(second);
  // Test the app-owned File hook independently of the native wallet UI.
  const input = second.locator('.rs-nextgraph-import input');
  await input.setInputFiles({ name: 'library.json', mimeType: 'application/json', buffer: bytes });
  await second.waitForFunction(() => document.querySelector('.rs-nextgraph-import [role=status]').textContent.startsWith('Imported'));
  await second.reload();
  await localReady(second);
  assert.equal(await second.locator('#installed-apps [data-app-id="webmarks"]').count(), 1);
  await input.setInputFiles({ name: 'future.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99,"apps":[]}') });
  await second.waitForFunction(() => document.querySelector('.rs-nextgraph-import [role=status]').textContent.includes('Choose a Ponder Source'));
  assert.equal(await second.locator('#installed-apps [data-app-id="webmarks"]').count(), 1);
});
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
  if (await page.locator('.rs-choose-rs').isVisible()) await page.locator('.rs-choose-rs').click();
  // Wait for pointer access to the animated form before focusing its input.
  await page.locator('[name=rs-user-address]').click();
  await page.locator('[name=rs-user-address]').fill('alice@storage.example');
  await page.locator('.rs-connect').click();
  await page.waitForFunction(() => document.querySelector('#storage-status').textContent.includes('connected to remoteStorage'));
}

test('real OPFS: install, reload, launch, recent apps, remove, keyboard navigation and mobile layout', async t => {
  const { context, page } = await open(t, { viewport: { width: 390, height: 844 } });
  await page.goto(base + '/#remotestorage=alice%40storage.example');
  await localReady(page);
  assert.equal(await page.locator('[name=rs-user-address]').inputValue(), 'alice@storage.example');
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

for (const [id, name, url] of [
  ['sharesome', 'Sharesome', 'https://sharesome.pondersource.com'],
  ['webmarks', 'Webmarks', 'https://webmarks.pondersource.com'],
  ['todonna', 'Todonna', 'https://todonna.pondersource.com'],
  ['inspektor', 'RS Inspektor', 'https://inspektor.pondersource.com'],
  ['savr', 'Savr', 'https://savr.pondersource.com'],
  ['marco', 'Marco', 'https://marco.pondersource.com'],
  ['solid-memo', 'Solid Memo', 'https://solid-memo.pondersource.com'],
  ['focus', 'Focus', 'https://focus.pondersource.com'],
  ['umai', 'Umai', 'https://umai.pondersource.com'],
  ['media-kraken', 'Media Kraken', 'https://media-kraken.pondersource.com']
]) {
  test(name + ' installs, persists and launches the hosted app', async t => {
    const { context, page } = await open(t);
    await context.route(url + '/**', route => route.fulfill({ body: name + ' fixture' }));
    await page.goto(base);
    await localReady(page);
    await install(page, id);
    await page.reload();
    await localReady(page);
    const launch = page.getByRole('link', { name: 'Launch ' + name, exact: true });
    assert.equal(await launch.getAttribute('href'), url);
    const popupReady = context.waitForEvent('page');
    await launch.click();
    const popup = await popupReady;
    await popup.waitForLoadState();
    assert.equal(new URL(popup.url()).origin, url);
    await popup.close();
    await page.waitForFunction(name => document.querySelector('#recent-list').textContent.includes(name), name);
    await page.getByRole('button', { name: 'Remove ' + name + ' from your launcher' }).click();
    await page.waitForFunction(() => document.querySelector('#installed-count').textContent === '(0)');
  });
}

for (const [id, name] of [['solid-memo', 'Solid Memo'], ['umai', 'Umai'], ['media-kraken', 'Media Kraken'], ['focus', 'Focus']]) {
  test(name + ' receives the remoteStorage account hint from the launcher', async t => {
    const { context, page } = await open(t);
    await remoteFixture(context, {
      version: 1,
      apps: [{ id, installed: true, updatedAt: 100, lastOpened: 0 }]
    });
    await page.goto(base);
    await localReady(page);
    await connect(page);
    const launch = page.getByRole('link', { name: 'Launch ' + name, exact: true });
    await launch.waitFor();
    assert.equal(await launch.getAttribute('href'), 'https://' + id + '.pondersource.com#remotestorage=' + encodeURIComponent('alice@storage.example'));
  });
}

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
  assert.equal(await page.locator('.install-app:disabled').count(), await page.locator('.install-app').count());
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
  await page.locator('.rs-box-connected .rs-disconnect').click();
  await localReady(page);
  assert.equal(await page.locator('#installed-count').textContent(), '(1)');
  assert.equal(await page.getByRole('link', { name: 'Launch Litewrite' }).getAttribute('href'), 'https://litewrite.pondersource.com');
  await connect(page);
  assert.equal(await page.locator('#installed-count').textContent(), '(1)');
  assert.equal(await page.getByRole('link', { name: 'Launch Hyperdraft' }).count(), 0);
});

test('disconnect restores the device library with another connected tab open', async t => {
  const { context, page } = await open(t);
  await remoteFixture(context, { version: 1, apps: [
    { id: 'hyperdraft', installed: true, updatedAt: 100, lastOpened: 0 }
  ] });
  await page.goto(base);
  await localReady(page);
  await install(page, 'litewrite');
  await connect(page);

  const second = await context.newPage();
  await second.goto(base);
  await second.getByRole('link', { name: 'Launch Hyperdraft' }).waitFor();

  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await page.getByRole('link', { name: 'Launch Litewrite' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Launch Hyperdraft' }).count(), 0);

  await page.reload();
  await localReady(page);
  assert.equal(await page.getByRole('link', { name: 'Launch Litewrite' }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Launch Hyperdraft' }).count(), 0);
});

test('invalid remote library blocks writes instead of resetting account data', async t => {
  const { context, page } = await open(t);
  const fixture = await remoteFixture(context, { version: 99, apps: [] });
  await page.goto(base);
  await localReady(page);
  if (await page.locator('.rs-choose-rs').isVisible()) await page.locator('.rs-choose-rs').click();
  await page.locator('[name=rs-user-address]').fill('alice@storage.example');
  await page.locator('.rs-connect').click();
  await page.locator('#library-error').waitFor({ state: 'visible' });
  assert.match(await page.locator('#library-error').textContent(), /format/);
  assert.equal(fixture.puts, 0);
  await page.getByRole('tab', { name: 'App store' }).click();
  assert.equal(await page.locator('.install-app:disabled').count(), await page.locator('.install-app').count());
  await page.locator('.rs-box-connected .rs-disconnect').click();
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
    await page.getByRole('button', { name: label }).click();
    await waitFor(() => authorization);
    assert.equal(authorization.searchParams.get('client_id'), 'public-test-client-id');
    assert.equal(new URL(authorization.searchParams.get('redirect_uri')).href, new URL(base).origin + '/');
    if (provider === 'dropbox') assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    else assert.match(authorization.searchParams.get('scope'), /drive/);
  });
}

test('LWS discovery displays the storage root and authorization server without changing accounts', async t => {
  const { context, page } = await open(t);
  const calls = [];
  await context.route('https://lws.example/**', async route => {
    const request = route.request();
    calls.push({ method: request.method(), url: request.url(), authorization: request.headers().authorization });
    const common = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Link, WWW-Authenticate' };
    if (request.url() === 'https://lws.example/alice/notes') {
      return route.fulfill({ status: 401, headers: { ...common,
        Link: '<https://lws.example/alice>; rel="https://www.w3.org/ns/lws#storage"',
        'WWW-Authenticate': 'Bearer resource_metadata="https://lws.example/metadata"'
      }, body: '' });
    }
    const body = request.url() === 'https://lws.example/alice' ?
      { id: 'https://lws.example/alice', type: 'Storage', service: [
        { type: 'StorageRoot', serviceEndpoint: 'https://lws.example/alice/data/' }
      ] } : { resource: 'https://lws.example/alice/notes', authorization_servers: ['https://login.example/'] };
    return route.fulfill({ contentType: 'application/json', headers: common, body: JSON.stringify(body) });
  });
  await page.goto(base);
  await localReady(page);
  await page.getByLabel('Find your LWS storage').fill('https://lws.example/alice/notes');
  await page.getByRole('button', { name: 'Find LWS storage', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#lws-discovery-result').textContent.includes('https://login.example/'));
  assert.deepEqual(await page.locator('#lws-discovery-result a').evaluateAll(links => links.map(link => link.href)), [
    'https://lws.example/alice', 'https://lws.example/alice/data/', 'https://login.example/'
  ]);
  assert.equal(await page.locator('.rs-box-connected').isVisible(), false);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.method === 'GET' && call.authorization === undefined));
  assert.match(await page.locator('#storage-status').textContent(), /saved on this device/);
});

test('LWS discovery reports CORS failures and can retry', async t => {
  const { context, page } = await open(t);
  await context.route('https://unavailable.example/**', route => route.abort('failed'));
  await page.goto(base);
  await localReady(page);
  await page.getByLabel('Find your LWS storage').fill('https://unavailable.example/storage/');
  await page.getByRole('button', { name: 'Find LWS storage', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#lws-discovery-status').textContent.includes('Could not discover'));
  assert.equal(await page.getByRole('button', { name: 'Find LWS storage', exact: true }).isEnabled(), true);
  assert.equal(await page.locator('#lws-discovery-result a').count(), 0);
});

test('Google Drive: empty account, install, upload, reload and restore after sign-out', { timeout: 90000 }, async t => {
  const { context, page } = await open(t);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  const fixture = await require('./google-drive-fixture.cjs')(context);
  await page.goto(base);
  await localReady(page);
  await page.getByRole('button', { name: 'Google Drive', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#storage-status').textContent.includes('connected to Google Drive'));
  await install(page, 'webmarks');
  await waitFor(() => [...fixture.files.values()].some(f => f.body?.includes('webmarks')));
  await page.reload();
  await page.getByRole('link', { name: 'Launch Webmarks', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await localReady(page);
  assert.equal(await page.getByRole('link', { name: 'Launch Webmarks', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Google Drive', exact: true }).click();
  await page.getByRole('link', { name: 'Launch Webmarks', exact: true }).waitFor();
  assert.equal(fixture.invalidReads, 0, 'missing library must not request metadata for an undefined file ID');
  await page.locator('#rs-login-error').waitFor({ state: 'hidden' });
  assert.ok(fixture.writes > 0);
});

test('mobile wallet selection stays visible after the provider list collapses', async t => {
  const { page } = await open(t, { viewport: { width: 390, height: 844 } });
  await page.goto(base);
  await localReady(page);
  await page.locator('.rs-choose-nextgraph').click();
  await page.waitForFunction(() => {
    const bounds = document.querySelector('.rs-nextgraph-form').getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight;
  });
  const input = page.locator('[name=rs-nextgraph-wallet]');
  assert.equal(await input.inputValue(), 'https://nextgraph.net');
  await input.fill('https://wallet.example.test');
  await page.locator('.rs-nextgraph-back').click();
  await page.locator('.rs-choose-nextgraph').click();
  await page.waitForFunction(() => document.querySelector('.rs-nextgraph-form').getBoundingClientRect().top >= 0);
  assert.equal(await input.inputValue(), 'https://wallet.example.test');
});
