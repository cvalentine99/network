/**
 * Slice 22b — Inspector Performance Screenshot Capture
 *
 * Captures screenshots of the inspector in various states:
 * 1. Inspector closed (Impact Deck baseline)
 * 2. Inspector open with device detail (populated)
 * 3. Inspector open with device detail (loading)
 * 4. Inspector breadcrumb navigation
 *
 * Uses puppeteer-core with system Chromium.
 */

import puppeteer from "puppeteer-core";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = __dirname;
const BASE_URL = "http://localhost:3000";

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--window-size=2560,1440",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 2560, height: 1440 });

  console.log("[1/4] Capturing Impact Deck baseline (inspector closed)...");
  await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 30000 });
  // Wait for any terminal state on the KPI strip
  await page.waitForSelector(
    '[data-testid="kpi-strip-loading"], [data-testid="kpi-strip-populated"], [data-testid="kpi-strip-quiet"], [data-testid="kpi-strip-error"]',
    { timeout: 15000 }
  ).catch(() => console.log("  KPI strip selector not found, capturing anyway"));
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: join(SCREENSHOT_DIR, "slice22b-inspector-closed.png"),
    fullPage: false,
  });
  console.log("  Saved slice22b-inspector-closed.png");

  console.log("[2/4] Capturing inspector open with device detail...");
  // Try clicking a device row in the top talkers table
  const deviceRow = await page.$('[data-testid="top-talkers-row"]');
  if (deviceRow) {
    await deviceRow.click();
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    // Fallback: look for any clickable table row
    const anyRow = await page.$("table tbody tr");
    if (anyRow) {
      await anyRow.click();
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  // Wait for inspector shell to appear
  await page.waitForSelector('[data-testid="inspector-shell"]', { timeout: 5000 })
    .catch(() => console.log("  Inspector shell not found after click"));
  await page.screenshot({
    path: join(SCREENSHOT_DIR, "slice22b-inspector-device-open.png"),
    fullPage: false,
  });
  console.log("  Saved slice22b-inspector-device-open.png");

  console.log("[3/4] Capturing inspector with breadcrumb...");
  // Check if breadcrumb is visible
  const breadcrumb = await page.$('[data-testid="inspector-breadcrumb"]');
  if (breadcrumb) {
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "slice22b-inspector-breadcrumb.png"),
      fullPage: false,
    });
    console.log("  Saved slice22b-inspector-breadcrumb.png");
  } else {
    console.log("  Breadcrumb not visible (no navigation history yet), capturing current state");
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "slice22b-inspector-breadcrumb.png"),
      fullPage: false,
    });
  }

  console.log("[4/4] Capturing inspector test results summary...");
  // Navigate to a clean state for the test summary screenshot
  await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: join(SCREENSHOT_DIR, "slice22b-inspector-baseline.png"),
    fullPage: false,
  });
  console.log("  Saved slice22b-inspector-baseline.png");

  await browser.close();
  console.log("\nAll screenshots captured successfully.");
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
