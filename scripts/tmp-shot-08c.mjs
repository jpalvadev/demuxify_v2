// 08c fidelity reads: full Mix stage (desktop + mobile) after the rack moved
// outside the 4-stems card, plus the section card and the rack row.
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
await desk.screenshot({ path: `${OUT}/app-mix-desktop-08c.png` });
for (const [sel, name] of [
  ["[aria-label='Stem Player']", "app-stemcard-08c"],
  ["[data-testid='dsp-rack-root']", "app-rack-08c"],
]) {
  const el = desk.locator(sel).first();
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${name} -> ${OUT}/${name}.png`);
}
// Geometry: stem card bottom edge vs rack first card top edge; expect 12px.
const geo = await desk.evaluate(() => {
  const card = document.querySelector(
    "[section] [aria-label='Stem Player'], [role='region'][aria-label='Stem Player']"
  );
  const rackCard = document
    .querySelector(
      "[data-testid='dsp-rack-root'] [data-testid='current-tempo-label']"
    )
    ?.closest?.("div")?.parentElement;
  const firstDsp = document
    .querySelector("[data-testid='dsp-rack-root']")
    .querySelector("[data-testid='current-tempo-label']");
  const dspCard = firstDsp ? firstDsp.closest("div.rounded-lg") : null;
  return {
    cardBottom: card ? Math.round(card.getBoundingClientRect().bottom) : null,
    dspTop: dspCard ? Math.round(dspCard.getBoundingClientRect().top) : null,
  };
});
console.log("gap card->rack:", geo);
await desk.close();

const mob = await openMix(390, 844);
await mob.screenshot({ path: `${OUT}/app-mix-mobile-08c.png` });
console.log("mobile full -> app-mix-mobile-08c.png");
await mob.close();
await browser.close();
