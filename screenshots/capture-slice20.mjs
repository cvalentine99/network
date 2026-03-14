/**
 * Slice 20 — Standalone Correlation Surface Screenshot Capture
 *
 * Captures:
 * 1. slice20-populated.png — full event feed with category pills and summary
 * 2. slice20-populated-expanded.png — event detail expanded
 * 3. slice20-quiet.png — no events in time window
 * 4. slice20-error.png — BFF error state
 * 5. slice20-loading.png — loading spinner
 * 6. slice20-filtered.png — category filter applied (subset visible)
 */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
const DELAY = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // ── 1. Populated ──────────────────────────────────────────────────
  console.log('1/6 Capturing populated state...');
  await page.goto(`${BASE}/correlation`, { waitUntil: 'networkidle2' });
  await DELAY(2000);
  await page.screenshot({ path: 'screenshots/slice20-populated.png', fullPage: true });
  console.log('  → slice20-populated.png');

  // ── 2. Populated with expanded detail ─────────────────────────────
  console.log('2/6 Capturing populated with expanded detail...');
  // Click the first event row to expand it
  const firstRow = await page.$('[data-testid^="event-row-"]');
  if (firstRow) {
    await firstRow.click();
    await DELAY(500);
  }
  await page.screenshot({ path: 'screenshots/slice20-populated-expanded.png', fullPage: true });
  console.log('  → slice20-populated-expanded.png');

  // ── 3. Filtered state ─────────────────────────────────────────────
  console.log('3/6 Capturing filtered state...');
  // Click "Clear All" to clear filters, then click one category
  const clearAllBtn = await page.$('button');
  // Find the Clear All button by text
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate((el) => el.textContent, btn);
    if (text && text.includes('Clear All')) {
      await btn.click();
      await DELAY(300);
      break;
    }
  }
  // Now click the first category filter pill to enable just one
  const filterPill = await page.$('[data-testid^="filter-"]');
  if (filterPill) {
    await filterPill.click();
    await DELAY(500);
  }
  await page.screenshot({ path: 'screenshots/slice20-filtered.png', fullPage: true });
  console.log('  → slice20-filtered.png');

  // ── 4. Quiet state ────────────────────────────────────────────────
  console.log('4/6 Capturing quiet state...');
  // Inject quiet sentinel by manipulating the hook's fetch
  await page.evaluate(() => {
    // Override fetch to return quiet fixture
    const origFetch = window.fetch;
    window.fetch = function(url, opts) {
      if (typeof url === 'string' && url.includes('/correlation/events')) {
        const body = JSON.parse(opts?.body || '{}');
        body.fromMs = 0;
        body.untilMs = 0;
        return origFetch.call(this, url, { ...opts, body: JSON.stringify(body) });
      }
      return origFetch.call(this, url, opts);
    };
    // Trigger a refetch by dispatching a custom event
    window.dispatchEvent(new CustomEvent('force-correlation-refetch'));
  });
  // Navigate fresh to trigger the quiet sentinel
  await page.goto(`${BASE}/correlation`, { waitUntil: 'networkidle2' });
  // Intercept the request to use quiet sentinel
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/correlation/events') && req.method() === 'POST') {
      req.continue({
        postData: JSON.stringify({ fromMs: 0, untilMs: 0 }),
      });
    } else {
      req.continue();
    }
  });
  await page.goto(`${BASE}/correlation`, { waitUntil: 'networkidle2' });
  await DELAY(2000);
  await page.screenshot({ path: 'screenshots/slice20-quiet.png', fullPage: true });
  console.log('  → slice20-quiet.png');

  // Clean up interception for next captures
  await page.setRequestInterception(false);

  // ── 5. Error state ────────────────────────────────────────────────
  console.log('5/6 Capturing error state...');
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1920, height: 1080 });
  await page2.setRequestInterception(true);
  page2.on('request', (req) => {
    if (req.url().includes('/correlation/events') && req.method() === 'POST') {
      req.continue({
        postData: JSON.stringify({ fromMs: 9999999999999, untilMs: 9999999999999 }),
      });
    } else {
      req.continue();
    }
  });
  await page2.goto(`${BASE}/correlation`, { waitUntil: 'networkidle2' });
  await DELAY(2000);
  await page2.screenshot({ path: 'screenshots/slice20-error.png', fullPage: true });
  console.log('  → slice20-error.png');
  await page2.close();

  // ── 6. Loading state ──────────────────────────────────────────────
  console.log('6/6 Capturing loading state...');
  const page3 = await browser.newPage();
  await page3.setViewport({ width: 1920, height: 1080 });
  await page3.setRequestInterception(true);
  page3.on('request', (req) => {
    if (req.url().includes('/correlation/events') && req.method() === 'POST') {
      // Delay the response to capture loading state
      setTimeout(() => {
        req.continue();
      }, 10000);
    } else {
      req.continue();
    }
  });
  await page3.goto(`${BASE}/correlation`, { waitUntil: 'domcontentloaded' });
  await DELAY(1500);
  await page3.screenshot({ path: 'screenshots/slice20-loading.png', fullPage: true });
  console.log('  → slice20-loading.png');
  await page3.close();

  await browser.close();
  console.log('\nAll 6 screenshots captured successfully.');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
