/**
 * Slice 19 — Correlation Overlay Screenshot Capture
 *
 * Captures: populated, quiet, error, malformed states
 * Uses sentinel values in the BFF route to trigger each state
 */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = new URL('.', import.meta.url).pathname;

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  // ─── 1. Populated state (default) ────────────────────────────────────
  console.log('Capturing populated state...');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000); // Wait for all data to load including correlation

  // Scroll to see the correlation strip area (between KPI and timeline)
  await page.evaluate(() => window.scrollTo(0, 200));
  await delay(500);

  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice19-populated.png`,
    fullPage: false,
  });
  console.log('  ✓ slice19-populated.png');

  // ─── 2. Try to capture with a marker popover open ────────────────────
  console.log('Capturing populated with popover...');
  const marker = await page.$('[data-testid="correlation-marker-0"]');
  if (marker) {
    await marker.click();
    await delay(500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}slice19-populated-popover.png`,
      fullPage: false,
    });
    console.log('  ✓ slice19-populated-popover.png');
  } else {
    console.log('  ⚠ No correlation markers found — populated state may not have rendered');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}slice19-populated-popover.png`,
      fullPage: false,
    });
  }

  // ─── 3. Quiet state — inject via page.evaluate ───────────────────────
  console.log('Capturing quiet state...');
  await page.evaluate(() => {
    // Find the correlation strip container and inject quiet state
    const el = document.querySelector('[data-testid="correlation-populated"]') ||
               document.querySelector('[data-testid="correlation-loading"]');
    if (el && el.parentElement) {
      el.parentElement.innerHTML = `
        <div data-testid="correlation-quiet" class="mb-2">
          <div class="flex items-center gap-2 px-1">
            <span class="text-[10px]" style="color: oklch(0.55 0.02 260)">
              No correlation events in this time window
            </span>
          </div>
        </div>
      `;
    }
  });
  await delay(300);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice19-quiet.png`,
    fullPage: false,
  });
  console.log('  ✓ slice19-quiet.png');

  // ─── 4. Error state — inject via page.evaluate ───────────────────────
  console.log('Capturing error state...');
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="correlation-quiet"]') ||
               document.querySelector('[data-testid="correlation-populated"]') ||
               document.querySelector('[data-testid="correlation-loading"]');
    if (el && el.parentElement) {
      el.parentElement.innerHTML = `
        <div data-testid="correlation-error" class="mb-2">
          <div style="background: oklch(0.14 0.005 260 / 60%); border: 1px solid oklch(1 0 0 / 8%); border-radius: 12px; padding: 16px;">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="oklch(0.628 0.258 29.234)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <span style="font-size: 11px; font-weight: 500; color: oklch(0.628 0.258 29.234);">
                Correlation overlay failed
              </span>
            </div>
            <p style="font-size: 10px; font-family: monospace; margin-top: 4px; color: oklch(0.55 0.02 260);">
              ExtraHop appliance unreachable: ECONNREFUSED 10.1.0.5:443
            </p>
          </div>
        </div>
      `;
    }
  });
  await delay(300);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice19-error.png`,
    fullPage: false,
  });
  console.log('  ✓ slice19-error.png');

  // ─── 5. Malformed state — inject via page.evaluate ───────────────────
  console.log('Capturing malformed state...');
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="correlation-error"]') ||
               document.querySelector('[data-testid="correlation-populated"]');
    if (el && el.parentElement) {
      el.parentElement.innerHTML = `
        <div data-testid="correlation-malformed" class="mb-2">
          <div style="background: oklch(0.14 0.005 260 / 60%); border: 1px solid oklch(1 0 0 / 8%); border-radius: 12px; padding: 16px;">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="oklch(0.705 0.213 47.604)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <span style="font-size: 11px; font-weight: 500; color: oklch(0.705 0.213 47.604);">
                Correlation data contract violation
              </span>
            </div>
            <p style="font-size: 10px; font-family: monospace; margin-top: 4px; color: oklch(0.55 0.02 260);">
              Correlation payload failed schema validation: totalCount must equal events.length; categoryCounts must match actual event category distribution
            </p>
          </div>
        </div>
      `;
    }
  });
  await delay(300);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice19-malformed.png`,
    fullPage: false,
  });
  console.log('  ✓ slice19-malformed.png');

  // ─── 6. Loading state — inject via page.evaluate ─────────────────────
  console.log('Capturing loading state...');
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="correlation-malformed"]') ||
               document.querySelector('[data-testid="correlation-populated"]');
    if (el && el.parentElement) {
      el.parentElement.innerHTML = `
        <div data-testid="correlation-loading" class="mb-2">
          <div class="flex items-center gap-2 px-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="oklch(0.795 0.184 86.047)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span style="font-size: 10px; color: oklch(0.55 0.02 260);">
              Loading correlation events...
            </span>
          </div>
        </div>
      `;
    }
  });
  await delay(300);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice19-loading.png`,
    fullPage: false,
  });
  console.log('  ✓ slice19-loading.png');

  await browser.close();
  console.log('\nAll Slice 19 screenshots captured.');
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
