/**
 * Slice 17 — Flow Theater: Error & Quiet State Screenshot Capture
 *
 * Uses sentinel values to trigger error and quiet SSE streams:
 * - Error: hostname "unknown.invalid" → trace-resolution-error.fixture.jsonl
 * - Quiet: hostname "quiet.lab.local" → trace-hostname-quiet.fixture.jsonl
 * - Partial error: device "8888" → trace-partial-error.fixture.jsonl
 */

import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = __dirname;
const BASE = 'http://localhost:3000';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function capture(page, name) {
  const path = join(SCREENSHOT_DIR, `slice17-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  ✓ ${name} → ${path}`);
}

async function main() {
  console.log('Slice 17 — Flow Theater Error/Quiet Screenshot Capture');
  console.log('======================================================');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  // 1. ERROR STATE — hostname "unknown.invalid"
  console.log('\n1. Error state (resolution error)...');
  await page.goto(`${BASE}/flow-theater`, { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1000);

  // Entry mode is already "hostname" by default
  // Type the error sentinel
  const input1 = await page.waitForSelector('[data-testid="trace-input"]');
  await input1.click({ clickCount: 3 });
  await input1.type('unknown.invalid');
  await delay(300);

  // Click submit
  const submit1 = await page.waitForSelector('[data-testid="trace-submit"]');
  await submit1.click();

  // Wait for SSE to complete (error events are fast)
  await delay(4000);
  await capture(page, 'error');

  // 2. Reset and do quiet state
  console.log('\n2. Quiet state...');
  const reset1 = await page.waitForSelector('[data-testid="trace-reset"]');
  await reset1.click();
  await delay(500);

  const input2 = await page.waitForSelector('[data-testid="trace-input"]');
  await input2.click({ clickCount: 3 });
  await input2.type('quiet.lab.local');
  await delay(300);

  const submit2 = await page.waitForSelector('[data-testid="trace-submit"]');
  await submit2.click();
  await delay(4000);
  await capture(page, 'quiet');

  // 3. Reset and do partial-error state
  console.log('\n3. Partial error state...');
  const reset2 = await page.waitForSelector('[data-testid="trace-reset"]');
  await reset2.click();
  await delay(500);

  // Switch to device mode for partial error
  const modeSelect = await page.waitForSelector('[data-testid="entry-mode-select"]');
  await modeSelect.click();
  await delay(300);
  // Select "Device ID" from the dropdown
  await page.evaluate(() => {
    const items = document.querySelectorAll('[role="option"]');
    for (const item of items) {
      if (item.textContent?.includes('Device ID')) {
        item.click();
        break;
      }
    }
  });
  await delay(300);

  const input3 = await page.waitForSelector('[data-testid="trace-input"]');
  await input3.click({ clickCount: 3 });
  await input3.type('8888');
  await delay(300);

  const submit3 = await page.waitForSelector('[data-testid="trace-submit"]');
  await submit3.click();
  await delay(4000);
  await capture(page, 'partial-error');

  await browser.close();
  console.log('\nDone. All error/quiet screenshots captured.');
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
