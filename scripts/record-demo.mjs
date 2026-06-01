// Records a deterministic CompliScore demo as a webm.
// Requires the dev server to already be running on http://localhost:3000.
//
// Usage:
//   node scripts/record-demo.mjs
//
// Output:
//   .recordings/raw/<random>.webm  (raw playwright capture)
// Post-process with ffmpeg (see scripts/encode-demo.sh).

import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.DEMO_URL ?? "http://localhost:3000";
const RAW_DIR = ".recordings/raw";
const OUT_PATH = ".recordings/compliscore-demo.webm";

const VIEWPORT = { width: 1280, height: 800 };

if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--hide-scrollbars", "--disable-blink-features=AutomationControlled"],
});

const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  recordVideo: { dir: RAW_DIR, size: VIEWPORT },
  reducedMotion: "no-preference",
});

const page = await context.newPage();

// Hide Next.js dev overlay / build indicator on every navigation so the
// recording is clean (no floating "N" badge in the corner).
await page.addInitScript(() => {
  const css = `
    nextjs-portal,
    [data-nextjs-toast],
    [data-nextjs-dev-tools-button],
    [data-next-mark],
    #__next-build-watcher,
    [data-nextjs-dialog-overlay],
    [data-nextjs-dialog] { display: none !important; visibility: hidden !important; }
  `;
  const style = document.createElement("style");
  style.setAttribute("data-record-demo", "true");
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);
});

console.log(`→ navigating to ${URL}`);
await page.goto(URL, { waitUntil: "networkidle" });

// Extra belt-and-braces: nuke any nextjs-portal that snuck in after load.
await page.evaluate(() => {
  document
    .querySelectorAll("nextjs-portal, [data-next-mark]")
    .forEach((el) => el.remove());
});

await page.waitForTimeout(1800);

console.log("→ click Razorpay (YC W15, fintech)");
await page.getByRole("button", { name: "Razorpay" }).click();

await page.waitForSelector("h2:has-text('Razorpay')", { timeout: 15000 });
await page.waitForTimeout(2400);

console.log("→ scroll to show animated score + AI action plan");
await page.evaluate(() => {
  window.scrollBy({ top: 340, behavior: "smooth" });
});
await page.waitForTimeout(2600);

console.log("→ scroll further to reveal lead form");
await page.evaluate(() => {
  window.scrollBy({ top: 360, behavior: "smooth" });
});
await page.waitForTimeout(2400);

console.log("→ scroll back to top");
await page.evaluate(() => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
await page.waitForTimeout(1400);

console.log("→ click Khatabook (YC S19, SMB SaaS — shows action items)");
await page.getByRole("button", { name: "Khatabook" }).click();

await page.waitForSelector("h2:has-text('Khatabook')", { timeout: 15000 });
await page.waitForTimeout(2600);

console.log("→ scroll to show Khatabook's score + pending tasks");
await page.evaluate(() => {
  window.scrollBy({ top: 340, behavior: "smooth" });
});
await page.waitForTimeout(2400);

console.log("→ closing context (flushes video)");
await context.close();
await browser.close();

const files = readdirSync(RAW_DIR).filter((f) => f.endsWith(".webm"));
if (files.length === 0) {
  console.error("no webm captured!");
  process.exit(1);
}
files.sort();
const last = join(RAW_DIR, files[files.length - 1]);
renameSync(last, OUT_PATH);
console.log(`✓ saved ${OUT_PATH}`);
