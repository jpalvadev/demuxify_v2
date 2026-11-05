// Element-level fidelity reads: the 08a Click Track card (desktop + mobile)
// and the phantom metronome card.
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
for (const [sel, name] of [
  ["[data-testid='click-track-rail']", "app-clickcard-08a"],
  ["[data-mockup-placeholder='true'][class*='space-y-3']", "app-metrocard-08a"],
]) {
  const el = desk.locator(sel).first();
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${name} -> ${OUT}/${name}.png`);
}

const mob = await openMix(390, 844);
const mobCard = mob.locator("[data-testid='click-track-rail']").first();
await mobCard.screenshot({ path: `${OUT}/app-clickcard-08a-mobile.png` });
console.log(
  "app-clickcard-08a-mobile ->",
  `${OUT}/app-clickcard-08a-mobile.png`
);
await browser.close();
