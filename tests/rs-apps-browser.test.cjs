const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LAUNCHER_TEST_URL || 'http://127.0.0.1:8000';
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); });
after(async () => { await browser?.close(); });

test('shared Solid controls connect, choose a pod, disconnect, and show failures', async t => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(base);
  await page.setContent('<main>Storage connection fixture</main>');
  await page.addScriptTag({ url: base + '/packages/rs-apps/index.cjs' });
  await page.evaluate(() => {
    const listeners = {};
    const rs = window.fixtureRS = {
      backend: 'remotestorage', connected: false,
      on(name, callback) { listeners[name] = callback; },
      solid: {
        getPodURLs() { return rs.backend === 'solid' ? ['https://pod.example/test/'] : null; },
        setAuthURL(url) { rs.issuer = url; },
        async connect() { rs.backend = 'solid'; listeners['pod-not-selected'](); },
        async setPodURL(url) { rs.pod = url; rs.connected = true; listeners.connected(); }
      },
      async disconnect() { rs.connected = false; rs.backend = 'remotestorage'; listeners.disconnected(); }
    };
    window.PonderSourceStorage.attachSolid(rs);
  });
  await page.getByText('Solid storage', { exact: true }).click();
  await page.getByLabel('Solid identity provider').fill('https://issuer.example/');
  await page.getByRole('button', { name: 'Connect Solid', exact: true }).click();
  await page.getByRole('button', { name: 'Use this pod' }).waitFor();
  assert.equal(await page.evaluate(() => window.fixtureRS.issuer), 'https://issuer.example/');
  await page.getByRole('button', { name: 'Use this pod' }).click();
  await page.getByText('Connected to Solid.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixtureRS.pod), 'https://pod.example/test/');
  await page.getByRole('button', { name: 'Disconnect storage' }).click();
  await page.getByLabel('Solid identity provider').waitFor();
  await page.evaluate(() => { window.fixtureRS.solid.connect = async () => { throw new Error('Provider unavailable'); }; });
  await page.getByRole('button', { name: 'Connect Solid', exact: true }).click();
  await page.getByText('Provider unavailable', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Connect Solid', exact: true }).isEnabled(), true);
});
