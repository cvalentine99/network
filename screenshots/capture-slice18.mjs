/**
 * Slice 18 — Blast Radius Screenshot Capture
 *
 * Captures: idle, loading, populated, quiet, error states
 * Uses Puppeteer to navigate to /blast-radius and trigger each state.
 */

import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = __dirname;
const BASE = 'http://localhost:3000';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function capture(page, name) {
  const path = join(SCREENSHOT_DIR, `slice18-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  ✓ ${name} → ${path}`);
}

async function main() {
  console.log('Slice 18 — Blast Radius Screenshot Capture');
  console.log('==========================================');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  // 1. IDLE STATE — navigate to blast-radius, no query submitted
  console.log('\n1. Idle state...');
  await page.goto(`${BASE}/blast-radius`, { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1500);
  await capture(page, 'idle');

  // 2. POPULATED STATE — enter device-id 1042 and submit
  console.log('\n2. Populated state...');
  // Select device-id mode (already default)
  const input = await page.waitForSelector('[data-testid="blast-radius-input"]');
  await input.click({ clickCount: 3 }); // select all
  await input.type('1042');
  await delay(300);
  const submitBtn = await page.waitForSelector('[data-testid="blast-radius-submit"]');
  await submitBtn.click();
  await delay(2000); // wait for response
  await capture(page, 'populated');

  // 3. QUIET STATE — enter quiet sentinel device
  console.log('\n3. Quiet state...');
  const input2 = await page.waitForSelector('[data-testid="blast-radius-input"]');
  await input2.click({ clickCount: 3 });
  await input2.type('9999');
  await delay(300);
  const submitBtn2 = await page.waitForSelector('[data-testid="blast-radius-submit"]');
  await submitBtn2.click();
  await delay(2000);
  await capture(page, 'quiet');

  // 4. ERROR STATE — enter error sentinel device
  console.log('\n4. Error state...');
  // Change mode to hostname
  const modeSelect = await page.waitForSelector('[data-testid="blast-radius-mode-select"]');
  await modeSelect.select('hostname');
  await delay(200);
  const input3 = await page.waitForSelector('[data-testid="blast-radius-input"]');
  await input3.click({ clickCount: 3 });
  await input3.type('unknown.invalid');
  await delay(300);
  const submitBtn3 = await page.waitForSelector('[data-testid="blast-radius-submit"]');
  await submitBtn3.click();
  await delay(2000);
  await capture(page, 'error');

  // 5. TRANSPORT ERROR STATE
  console.log('\n5. Transport error state...');
  await modeSelect.select('device-id');
  await delay(200);
  const input4 = await page.waitForSelector('[data-testid="blast-radius-input"]');
  await input4.click({ clickCount: 3 });
  await input4.type('transport.fail');
  await delay(300);
  const submitBtn4 = await page.waitForSelector('[data-testid="blast-radius-submit"]');
  await submitBtn4.click();
  await delay(2000);
  await capture(page, 'transport-error');

  // 6. HOSTNAME ENTRY — populated via hostname
  console.log('\n6. Hostname entry populated...');
  await modeSelect.select('hostname');
  await delay(200);
  const input5 = await page.waitForSelector('[data-testid="blast-radius-input"]');
  await input5.click({ clickCount: 3 });
  await input5.type('mail-relay.lab.local');
  await delay(300);
  const submitBtn5 = await page.waitForSelector('[data-testid="blast-radius-submit"]');
  await submitBtn5.click();
  await delay(2000);
  await capture(page, 'hostname-populated');

  await browser.close();
  console.log('\nDone. All screenshots captured.');
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
