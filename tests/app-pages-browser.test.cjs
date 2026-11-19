const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LAUNCHER_TEST_URL || 'http://127.0.0.1:8000';
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); });
after(async () => { await browser?.close(); });

test('all apps are discoverable and usable without JavaScript on mobile and desktop', async t => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole('link', { name: 'Explore all apps', exact: true }).click();
  const paths = await page.locator('.app-card h2 a').evaluateAll(links => links.map(a => a.getAttribute('href')));
  assert.equal(paths.length, 12);
  assert.equal(new Set(paths).size, 12);
  const sitemapResponse = await context.request.get(base + '/sitemap.xml');
  assert.equal(sitemapResponse.status(), 200);
  const sitemap = await sitemapResponse.text();
  const robots = await context.request.get(base + '/robots.txt');
  assert.match(await robots.text(), /Sitemap: https:\/\/pondersource.com\/sitemap.xml/);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/apps/', ...paths]) {
      assert.equal((await page.goto(base + path)).status(), 200);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://pondersource.com' + path);
      assert.ok(await page.locator('meta[name="description"]').getAttribute('content'));
      assert.ok(sitemap.includes('<loc>https://pondersource.com' + path + '</loc>'));
      await page.locator('footer').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('img').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0)), 'all app icons load');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
      if (path !== '/apps/') {
        const id = path.split('/')[2];
        assert.equal(await page.getByRole('link', { name: /^Open / }).getAttribute('href'), 'https://' + id + '.pondersource.com/');
      }
    }
  }
  await page.goto(base + '/index.html');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://pondersource.com/');
});
