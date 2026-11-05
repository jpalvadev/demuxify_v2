// Screenshot pass for the Mix stage: debug mode (#debug in the URL) boots a
// synthetic session, so the real Mix/Export compositions render at capture
// time. The UI path under shot is the shipped one; only the media is the
// fixture. The shell pass (shot.mjs) covers band/footer without the flag.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const log = console.log;

const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
mkdirSync(OUT, { recursive: true });

const URL = "https://localhost:5174/#debug";

const browser = await chromium.launch();
for (const [name, w, h] of [
  ["app-mix-desktop", 1440, 900],
  ["app-mix-mobile", 390, 844],
]) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    ignoreHTTPSErrors: true,
  });
  page.on("page_error", (err) => log("PAGEERR: " + err));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(2200);
  const nav = page.locator("[aria-label='Tab Band']");
  const buttons = await nav.locator("button").all();
  const labels = [];
  for (const btn of buttons) labels.push((await btn.innerText()).trim());
  log(`band buttons: ${labels.join(" | ")}`);
  let clicked = false;
  for (const btn of buttons) {
    if ((await btn.innerText()).toUpperCase().includes("MIX")) {
      await btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) log("WARN: Mix chip not clickable");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  log(`${name} -> ${OUT}/${name}.png`);
}
await browser.close();
