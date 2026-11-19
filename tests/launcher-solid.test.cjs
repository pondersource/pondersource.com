const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const issuer = 'http://localhost:3000';
const base = 'http://localhost:8000';

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await delay(1000);
  }
  throw new Error('Server did not start: ' + url);
}

async function login(page) {
  await page.goto(base);
  await page.locator('#solid-issuer').fill(issuer);
  await page.getByRole('button', { name: 'Connect Solid' }).click();
  await page.locator('input[type=email]').fill('solid-test@example.test');
  await page.locator('input[type=password]').fill(process.env.RS_SOLID_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('button', { name: 'Authorize', exact: true }).click();
  await page.getByRole('button', { name: 'Use this pod' }).click();
  await page.waitForFunction(() => document.querySelector('#storage-status').textContent.includes('connected to Solid'));
}

test('the Solid pod stores the launcher library across browser contexts', { timeout: 150_000 }, async () => {
  await Promise.all([waitForServer(base), waitForServer(issuer + '/.well-known/openid-configuration')]);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const first = await browser.newPage();
    await login(first);
    await first.getByRole('tab', { name: 'App store' }).click();
    const card = first.locator('[data-app-id="webmarks"]');
    const persisted = first.waitForResponse(response =>
      response.url() === issuer + '/sync-test/launcher/installed-apps' &&
      response.request().method() === 'PUT' && response.ok());
    await card.getByRole('button', { name: 'Install app' }).click();
    await persisted;
    const anonymous = await fetch(issuer + '/sync-test/launcher/installed-apps');
    assert.ok([401, 403, 404].includes(anonymous.status));

    const second = await browser.newPage();
    await login(second);
    await second.locator('#installed-apps').getByRole('heading', { name: 'Webmarks' }).waitFor();
  } finally {
    await browser.close();
  }
});
