// Scratch screenshot channel: capture ANY Tab at #debug. Args: tab label,
// optional "lower" to clip the bottom 60% of the page (for below-fold cards).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const log = console.log;
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
mkdirSync(OUT, { recursive: true });

const TAB = (process.argv[2] || "mix").toLowerCase();
const LOWER = process.argv.includes("lower");

const browser = await chromium.launch();
for (const [name, w, h] of [
  ["d", 1440, 900],
  ["m", 390, 844],
]) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    ignoreHTTPSErrors: true,
  });
  page.on("page_error", (err) => log("PAGEERR: " + err));
  await page.goto("https://localhost:5174/#debug", { waitUntil: "load" });
  await page.waitForTimeout(2200);
  const nav = page.locator("[aria-label='Tab Band']");
  const buttons = await nav.locator("button").all();
  let clicked = false;
  for (const btn of buttons) {
    if ((await btn.innerText()).toUpperCase().includes(TAB.toUpperCase())) {
      await btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) log(`WARN: ${TAB} chip not clickable`);
  await page.waitForTimeout(1000);
  if (LOWER) {
    const dims = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight,
    }));
    const clipH = Math.round(dims.h * 0.6);
    await page.screenshot({
      path: `${OUT}/app-${TAB}-${name}-lower.png`,
      clip: { x: 0, y: dims.h - clipH, width: w, height: clipH },
    });
    log(
      `app-${TAB}-${name}-lower -> ${OUT}/app-${TAB}-${name}-lower.png (page h ${dims.h})`
    );
  } else {
    await page.screenshot({
      path: `${OUT}/app-${TAB}-${name}.png`,
      fullPage: true,
    });
    log(`app-${TAB}-${name} -> ${OUT}/app-${TAB}-${name}.png`);
  }
}
await browser.close();
