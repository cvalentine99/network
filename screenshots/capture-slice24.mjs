/**
 * Slice 24 — Help Page Screenshot Capture
 * Captures all 4 tab states plus glossary search empty state.
 */
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const DIR = new URL('.', import.meta.url).pathname;

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Navigate to Help page
  await page.goto(`${BASE}/help`, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.waitForSelector('[data-testid="help-page"]', { timeout: 10000 });

  // 1. Glossary tab (default)
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${DIR}slice24-help-glossary.png`, fullPage: false });
  console.log('✓ Glossary tab captured');

  // 2. Glossary empty search
  const searchInput = await page.$('[data-testid="glossary-search"]');
  if (searchInput) {
    await searchInput.click({ clickCount: 3 });
    await searchInput.type('xyznonexistent');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${DIR}slice24-help-glossary-empty.png`, fullPage: false });
    console.log('✓ Glossary empty state captured');
    await searchInput.click({ clickCount: 3 });
    await searchInput.type('');
  }

  // 3. Shortcuts tab
  const shortcutsTab = await page.$('[data-testid="help-tab-shortcuts"]');
  if (shortcutsTab) {
    await shortcutsTab.click();
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${DIR}slice24-help-shortcuts.png`, fullPage: false });
    console.log('✓ Shortcuts tab captured');
  }

  // 4. Surfaces tab
  const surfacesTab = await page.$('[data-testid="help-tab-surfaces"]');
  if (surfacesTab) {
    await surfacesTab.click();
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${DIR}slice24-help-surfaces.png`, fullPage: false });
    console.log('✓ Surfaces tab captured');
  }

  // 5. Integration tab
  const integrationTab = await page.$('[data-testid="help-tab-integration"]');
  if (integrationTab) {
    await integrationTab.click();
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${DIR}slice24-help-integration.png`, fullPage: false });
    console.log('✓ Integration tab captured');
  }

  await browser.close();
  console.log('\nAll Help page screenshots captured.');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
