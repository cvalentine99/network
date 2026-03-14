/**
 * Slice 21 — Living Topology: Screenshot Capture
 *
 * Captures:
 * 1. slice21-loading.png       — initial loading spinner
 * 2. slice21-populated.png     — 15-node constellation view (default)
 * 3. slice21-detail-panel.png  — node detail panel open after clicking a node
 * 4. slice21-quiet.png         — empty topology (sentinel fromMs=1)
 * 5. slice21-error.png         — error state (sentinel fromMs=2)
 * 6. slice21-large-scale.png   — 200-node view (sentinel fromMs=5)
 *
 * Sentinel injection: intercepts fetch to /api/bff/topology/query and
 * rewrites the body's fromMs to the sentinel value before forwarding.
 */

import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = new URL('.', import.meta.url).pathname;
const VIEWPORT = { width: 1920, height: 1080 };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Set up request interception to rewrite topology query fromMs to a sentinel value.
 */
async function setupSentinel(page, sentinelFromMs) {
  await page.setRequestInterception(true);
  page.removeAllListeners('request');
  page.on('request', (req) => {
    if (req.url().includes('/api/bff/topology/query') && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      body.fromMs = sentinelFromMs;
      body.toMs = sentinelFromMs + 1;
      req.continue({
        postData: JSON.stringify(body),
        headers: { ...req.headers(), 'content-type': 'application/json' },
      });
    } else {
      req.continue();
    }
  });
}

async function clearInterception(page) {
  page.removeAllListeners('request');
  await page.setRequestInterception(false);
}

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // ─── 1. Loading state ──────────────────────────────────────────
  // Intercept the topology query and delay it to capture loading state
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/bff/topology/query') && req.method() === 'POST') {
      // Delay the response by holding the request
      setTimeout(() => req.continue(), 5000);
    } else {
      req.continue();
    }
  });
  await page.goto(`${BASE}/topology`, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  await page.screenshot({ path: `${SCREENSHOT_DIR}slice21-loading.png`, fullPage: false });
  console.log('✓ slice21-loading.png');

  // Clear interception and wait for full load
  await clearInterception(page);

  // ─── 2. Populated state (default — 15 nodes) ──────────────────
  await page.goto(`${BASE}/topology`, { waitUntil: 'networkidle0' });
  await sleep(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}slice21-populated.png`, fullPage: false });
  console.log('✓ slice21-populated.png');

  // ─── 3. Detail panel — click a node circle ─────────────────────
  try {
    // Wait for SVG nodes to render
    await page.waitForSelector('[data-testid="topology-nodes"] circle', { timeout: 5000 });
    const circles = await page.$$('[data-testid="topology-nodes"] circle');
    if (circles.length > 0) {
      // Click the first node
      await circles[0].click();
      await sleep(800);
      await page.screenshot({ path: `${SCREENSHOT_DIR}slice21-detail-panel.png`, fullPage: false });
      console.log('✓ slice21-detail-panel.png');
    } else {
      console.log('⚠ No node circles found for detail panel screenshot');
    }
  } catch (e) {
    console.log('⚠ Detail panel click failed:', e.message);
    // Take screenshot anyway to show current state
    await page.screenshot({ path: `${SCREENSHOT_DIR}slice21-detail-panel.png`, fullPage: false });
    console.log('✓ slice21-detail-panel.png (fallback)');
  }

  // ─── 4. Quiet state (sentinel fromMs=1) ────────────────────────
  await setupSentinel(page, 1);
  await page.goto(`${BASE}/topology`, { waitUntil: 'networkidle0' });
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}slice21-quiet.png`, fullPage: false });
  console.log('✓ slice21-quiet.png');
  await clearInterception(page);

  // ─── 5. Error state (sentinel fromMs=2) ────────────────────────
  await setupSentinel(page, 2);
  await page.goto(`${BASE}/topology`, { waitUntil: 'networkidle0' });
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}slice21-error.png`, fullPage: false });
  console.log('✓ slice21-error.png');
  await clearInterception(page);

  // ─── 6. Large-scale (200 nodes, sentinel fromMs=5) ─────────────
  await setupSentinel(page, 5);
  await page.goto(`${BASE}/topology`, { waitUntil: 'networkidle0' });
  await sleep(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}slice21-large-scale.png`, fullPage: false });
  console.log('✓ slice21-large-scale.png');
  await clearInterception(page);

  await browser.close();
  console.log('\nDone. All screenshots saved to:', SCREENSHOT_DIR);
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
