/**
 * Slice 17 — Flow Theater Screenshot Capture
 *
 * Captures 3 screenshots:
 * 1. Idle state — page load, no trace started
 * 2. Running state — trace in progress with steps updating
 * 3. Complete state — trace finished with summary card
 *
 * Uses page.evaluate() to properly trigger React state changes
 * instead of Puppeteer's input.type() which doesn't fire React onChange.
 */

import puppeteer from "puppeteer";

const BASE_URL = "http://localhost:3000";
const FLOW_THEATER_URL = `${BASE_URL}/flow-theater`;
const SCREENSHOT_DIR = new URL(".", import.meta.url).pathname;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log("Navigating to Flow Theater...");
  await page.goto(FLOW_THEATER_URL, { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(1000);

  // ── Screenshot 1: Idle State ──────────────────────────────────────────────
  console.log("Capturing idle state...");
  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice17-idle.png`,
    fullPage: false,
  });
  console.log("✓ slice17-idle.png");

  // ── Screenshot 2: Running State ───────────────────────────────────────────
  // Use page.evaluate to set the input value via React's synthetic event system
  console.log("Setting hostname input via React...");

  // Find the input and set its value using native input setter + dispatch events
  await page.evaluate(() => {
    const input = document.querySelector('[data-testid="trace-input"]');
    if (!input) throw new Error("trace-input not found");

    // Use the native setter to bypass React's controlled input
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    nativeInputValueSetter.call(input, "dc01.lab.local");

    // Dispatch the input event to trigger React's onChange
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await sleep(300);

  // Verify the input value was set
  const inputVal = await page.$eval('[data-testid="trace-input"]', (el) => el.value);
  console.log("Input value:", inputVal);

  if (inputVal !== "dc01.lab.local") {
    console.error("FAILED to set input value. Got:", inputVal);
    await browser.close();
    process.exit(1);
  }

  // Click the submit button
  console.log("Clicking Run Trace...");
  await page.click('[data-testid="trace-submit"]');

  // Wait for the trace rail to appear and some steps to start running
  console.log("Waiting for trace rail to appear...");
  await page.waitForSelector('[data-testid="trace-rail"]', { timeout: 5000 });

  // Wait 1 second for some SSE events to arrive (at 150ms intervals, ~6-7 events)
  await sleep(1000);

  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice17-running.png`,
    fullPage: false,
  });
  console.log("✓ slice17-running.png");

  // ── Screenshot 3: Complete State ──────────────────────────────────────────
  // Wait for the trace to complete (19 events at 150ms = ~2.85s)
  console.log("Waiting for trace to complete...");

  // Wait for the summary card to appear (indicates complete state)
  try {
    await page.waitForSelector('[data-testid="trace-summary-card"]', {
      timeout: 10000,
    });
    console.log("Summary card appeared");
  } catch {
    console.log("Summary card did not appear within timeout, capturing anyway");
  }

  await sleep(500);

  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice17-complete.png`,
    fullPage: true,
  });
  console.log("✓ slice17-complete.png");

  // ── Screenshot 4: Above-fold (same as complete but viewport only) ─────────
  await page.screenshot({
    path: `${SCREENSHOT_DIR}slice17-above-fold.png`,
    fullPage: false,
  });
  console.log("✓ slice17-above-fold.png");

  await browser.close();
  console.log("\nAll screenshots captured successfully.");
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
