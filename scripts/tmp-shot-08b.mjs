// 08b fidelity reads: the DSP rack row with the live Click Track card (desktop
// + mobile), the card itself, and the stem section (must show no click card).
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
  ["[data-testid='dsp-rack-root']", "app-rack-08b"],
  ["[data-testid='click-track-rail']", "app-clickcard-08b"],
]) {
  const el = desk.locator(sel).first();
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${name} -> ${OUT}/${name}.png`);
}
// The stem section between masthead and rack: no stray click card may remain.
const section = await desk.locator("body").first();
await section.screenshot({
  path: `${OUT}/app-mix-desktop-08b.png`,
  clip: { x: 0, y: 0, width: 1440, height: 900 },
});
console.log(
  "probe: placeholder metronome card count =",
  await desk
    .locator("[data-testid='click-track-rail'][data-mockup-placeholder='true']")
    .count()
);
await desk.close();

const mob = await openMix(390, 844);
for (const [sel, name] of [
  ["[data-testid='dsp-rack-root']", "app-rack-08b-mobile"],
  ["[data-testid='click-track-rail']", "app-clickcard-08b-mobile"],
]) {
  const el = mob.locator(sel).first();
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${name} -> ${OUT}/${name}.png`);
}
await mob.close();
await browser.close();
