/**
 * Slice 23 — Cross-Surface Navigation Screenshot Capture
 *
 * Captures screenshots showing the cross-surface nav buttons
 * on each surface where they appear.
 */
import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const SCREENSHOTS_DIR = __dirname;

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Topology page — node detail with Blast Radius button
  console.log('Capturing Topology with cross-nav...');
  await page.goto(`${BASE}/topology`, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.waitForSelector('[data-testid="topology-page-populated"], [data-testid="topology-page-quiet"], [data-testid="topology-page-loading"]', { timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'slice23-topology-crossnav.png'), fullPage: false });

  // 2. Correlation page — event refs with nav buttons
  console.log('Capturing Correlation with cross-nav...');
  await page.goto(`${BASE}/correlation`, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.waitForSelector('[data-testid="correlation-page-populated"], [data-testid="correlation-page-quiet"], [data-testid="correlation-page-idle"]', { timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'slice23-correlation-crossnav.png'), fullPage: false });

  // 3. Blast Radius page — with nav params pre-filled (idle state shows entry form)
  console.log('Capturing Blast Radius with cross-nav...');
  await page.goto(`${BASE}/blast-radius?brMode=device-id&brValue=1042&brAuto=1`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'slice23-blast-radius-crossnav.png'), fullPage: false });

  // 4. Flow Theater page — with nav params pre-filled
  console.log('Capturing Flow Theater with cross-nav...');
  await page.goto(`${BASE}/flow-theater?ftMode=hostname&ftValue=dc01.lab.local&ftAuto=1`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'slice23-flow-theater-crossnav.png'), fullPage: false });

  // 5. Blast Radius idle (no nav params — quiet state)
  console.log('Capturing Blast Radius idle...');
  await page.goto(`${BASE}/blast-radius`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'slice23-blast-radius-idle.png'), fullPage: false });

  await browser.close();
  console.log('All Slice 23 screenshots captured.');
}

capture().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
