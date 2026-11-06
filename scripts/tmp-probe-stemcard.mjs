// Throwaway close-up probe: clip-shoots the first stem card (Vocals) at
// deviceScaleFactor 2, mobile and desktop, to inspect knob/track alignment.
import { chromium } from "playwright";

const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
const URL = (process.argv[2] || "https://localhost:5174/") + "#debug";

const browser = await chromium.launch();
for (const [name, w, h] of [
  ["probe-card-mobile", 390, 844],
  ["probe-card-desktop", 1440, 900],
]) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
  });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(2200);
  const nav = page.locator("[aria-label='Tab Band']");
  const buttons = await nav.locator("button").all();
  for (const btn of buttons) {
    if ((await btn.innerText()).toUpperCase().includes("MIX")) {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(1200);
  const card = page.locator('[role="group"][aria-label="Vocals Stem"]').first();
  await card.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${name} -> ${OUT}/${name}.png`);
  await page.close();
}
await browser.close();
