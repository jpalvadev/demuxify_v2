// 08d fidelity reads: Mix stage desktop + mobile, the footer transport bar
// before and after pressing the coral disc (play state flips the icon and
// aria-pressed).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function openMix(w, h) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 2,
  });
  await page.goto("https://localhost:5175/#debug", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const nav = page.locator("[aria-label='Tab Band']");
  for (const btn of await nav.locator("button").all()) {
    if ((await btn.innerText()).toUpperCase().includes("MIX")) {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(1200);
  return page;
}

const desk = await openMix(1440, 900);
await desk.screenshot({ path: `${OUT}/app-mix-desktop-08d.png` });

const footer = desk.locator("footer").first();
await footer.screenshot({ path: `${OUT}/app-footer-idle-08d.png` });

const disc = desk.locator("[data-testid='footer-play-pause']").first();
const readDisc = () =>
  desk.evaluate(() => {
    const b = document.querySelector("[data-testid='footer-play-pause']");
    return {
      pressed: b.getAttribute("aria-pressed"),
      shape: b.innerHTML.includes("polygon") ? "play" : "pause",
    };
  });
const before = await readDisc();
await disc.click();
await desk.waitForTimeout(600);
const after = await readDisc();
await footer.screenshot({ path: `${OUT}/app-footer-playing-08d.png` });
// Let the engine run, then press again (pause) and read back.
await desk.waitForTimeout(1200);
await disc.click();
await desk.waitForTimeout(400);
const paused = await readDisc();
console.log(
  "idle:",
  before,
  "| after press:",
  after,
  "| after press 2:",
  paused
);

const mob = await openMix(390, 844);
await mob.screenshot({ path: `${OUT}/app-mix-mobile-08d.png` });

await browser.close();
