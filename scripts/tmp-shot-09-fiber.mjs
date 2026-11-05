// Ticket 09: sample the app's live engine (via TEMP __lastEngine hook).
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
const WAV = `${OUT}/probe-09.wav`;
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
await page.goto("https://localhost:5173/", { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.setInputFiles('input[aria-label="Select Source Mix file"]', WAV);
await page.waitForTimeout(3500);
await page.getByText("Ultra Fast", { exact: false }).first().click();
await page
  .getByRole("button", { name: /separate stems/i })
  .first()
  .click();
await page.waitForFunction(
  () => !!document.querySelector('[aria-label="Separation Complete"]'),
  null,
  { timeout: 180000 }
);
const band = page.locator("[aria-label='Tab Band']");
for (const chip of await band.locator("button").all()) {
  if ((await chip.innerText()).toUpperCase().includes("MIX")) {
    await chip.click();
    break;
  }
}
await page.waitForTimeout(1500);
const base = await page.evaluate(() => {
  const eng = window.__lastEngine;
  if (!eng) return { found: false };
  const tap = eng.getLevelTapNodes();
  window.__lv = [];
  eng.subscribeLevels((l) => window.__lv.push(l));
  return {
    found: true,
    taps: { s: !!tap.splitter, m: !!tap.merger, l: !!tap.left, r: !!tap.right },
    ctxState: eng.getAudioContext ? eng.getAudioContext().state : "n/a",
  };
});
console.log("engine:", JSON.stringify(base));
if (base.found) {
  await page.getByTestId("footer-play-pause").click();
  await page.waitForTimeout(2500);
  const mid = await page.evaluate(() => {
    const eng = window.__lastEngine;
    const tap = eng.getLevelTapNodes();
    const sample = (an) => {
      const a = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(a);
      let mx = 0;
      for (let i = 0; i < a.length; i++) mx = Math.max(mx, Math.abs(a[i]));
      return Math.round(mx * 1000) / 1000;
    };
    const lit = (id) => {
      const r = document.querySelector(`[data-testid="${id}"]`);
      return r
        ? [...r.querySelectorAll("span")].filter((s) =>
            /bg-st-ok|bg-st-coral/.test(s.className)
          ).length
        : -1;
    };
    return {
      playing: eng.isPlaying(),
      ctxTime: Math.round(eng.getAudioContext().currentTime * 100) / 100,
      getLevels: eng.getLevels(),
      emitted: window.__lv.length,
      last: window.__lv[window.__lv.length - 1],
      tapL: sample(tap.left),
      tapR: sample(tap.right),
      litL: lit("footer-peak-pips-left"),
      litR: lit("footer-peak-pips-right"),
    };
  });
  console.log("mid-play:", JSON.stringify(mid));
  await page.screenshot({
    path: `${OUT}/app-09-footer-playing.png`,
    clip: await page.locator("footer").boundingBox(),
  });
  await page.getByTestId("footer-play-pause").click();
  await page.waitForTimeout(800);
  const paused = await page.evaluate(() => ({
    levels: window.__lastEngine.getLevels(),
    litL: (() => {
      const r = document.querySelector('[data-testid="footer-peak-pips-left"]');
      return [...r.querySelectorAll("span")].filter((s) =>
        /bg-st-ok|bg-st-coral/.test(s.className)
      ).length;
    })(),
  }));
  console.log("paused:", JSON.stringify(paused));
  await page.screenshot({
    path: `${OUT}/app-09-footer-paused.png`,
    clip: await page.locator("footer").boundingBox(),
  });
}
await browser.close();
console.log("done");
