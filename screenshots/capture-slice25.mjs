/**
 * Slice 25 — Responsive Layout Audit Screenshot Capture
 * Captures every major surface at 3 breakpoints: desktop (1440), tablet (768), narrow (375).
 * Uses fresh pages per capture to avoid stalling.
 */
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const DIR = new URL('.', import.meta.url).pathname;

const BREAKPOINTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'narrow', width: 375, height: 812 },
];

const SURFACES = [
  { name: 'impact-deck', path: '/' },
  { name: 'flow-theater', path: '/flow-theater' },
  { name: 'blast-radius', path: '/blast-radius' },
  { name: 'correlation', path: '/correlation' },
  { name: 'topology', path: '/topology' },
  { name: 'settings', path: '/settings' },
  { name: 'help', path: '/help' },
];

async function captureOne(browser, surface, bp) {
  const page = await browser.newPage();
  await page.setViewport({ width: bp.width, height: bp.height });
  try {
    await page.goto(`${BASE}${surface.path}`, { waitUntil: 'networkidle2', timeout: 12000 });
    await new Promise(r => setTimeout(r, 800));
    const filename = `slice25-${surface.name}-${bp.name}.png`;
    await page.screenshot({ path: `${DIR}${filename}`, fullPage: false });
    console.log(`✓ ${filename}`);
  } catch (err) {
    console.error(`✗ ${surface.name} @ ${bp.name}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  for (const bp of BREAKPOINTS) {
    for (const surface of SURFACES) {
      await captureOne(browser, surface, bp);
    }
  }

  await browser.close();
  console.log(`\nDone. ${BREAKPOINTS.length * SURFACES.length} screenshots.`);
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
