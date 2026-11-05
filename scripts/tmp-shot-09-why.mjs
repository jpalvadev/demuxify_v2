// Ticket 09: find the app's live engine via React fiber, sample ITS analysers.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
const WAV = `${OUT}/probe-09.wav`;
const rate = 44100,
  n = rate * 6,
  bytes = 44 + n * 4;
const buf = Buffer.alloc(bytes);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + n * 4, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(rate, 24);
buf.writeUInt32LE(rate * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  const t = i / rate;
  const s = Math.sin(2 * Math.PI * 440 * t);
  buf.writeInt16LE(Math.round(s * 0.8 * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(s * 0.2 * 32767), 44 + i * 4 + 2);
}
writeFileSync(WAV, buf);

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
console.log("separation complete");
const band = page.locator("[aria-label='Tab Band']");
for (const chip of await band.locator("button").all()) {
  if ((await chip.innerText()).toUpperCase().includes("MIX")) {
    await chip.click();
    break;
  }
}
await page.waitForTimeout(1500);

// Hook: scan React fiber state for the engine (getLevelTapNodes fingerprint).
await page.addScriptTag({
  content: `
window.__findEngine = function () {
  function fromFiber(fiber, depth, seen) {
    if (!fiber || depth > 30 || seen.has(fiber)) return null;
    seen.add(fiber);
    for (const bag of [fiber.stateNode, fiber.memoizedState, fiber.memoizedProps]) {
      const found = scanObj(bag, 0);
      if (found) return found;
    }
    return fromFiber(fiber.child, depth + 1, seen) || fromFiber(fiber.sibling, depth + 1, seen);
  }
  function scanObj(o, depth) {
    if (!o || typeof o !== "object" || depth > 5) return null;
    if (typeof o.getLevelTapNodes === "function" && typeof o.getMasterGainNode === "function") return o;
    if (o.current && typeof o.current === "object") { const r = scanObj(o.current, depth + 1); if (r) return r; }
    if (o.engine && typeof o.engine === "object") { const r = scanObj(o.engine, depth + 1); if (r) return r; }
    for (const k of Object.keys(o)) {
      if (k === "engine" || k === "current" || k === "stateNode" || k === "memoizedState") continue;
      try { const v = o[k];
        if (v && typeof v === "object" && typeof v.getLevelTapNodes === "function") return v;
      } catch (e) {}
    }
    return null;
  }
  const root = document.getElementById("root");
  const key = Object.keys(root).find(k => k.startsWith("__reactContainer") || k.startsWith("__reactFiber"));
  const fiber = root[key];
  return fromFiber(fiber, 0, new WeakSet());
};`,
});

const info = await page.evaluate(() => {
  const eng = window.__findEngine();
  window.__eng = eng;
  if (!eng) return { found: false };
  const tap = eng.getLevelTapNodes();
  const lv = [];
  eng.subscribeLevels((l) => lv.push(l));
  window.__lv = lv;
  return {
    found: true,
    taps: { s: !!tap.splitter, m: !!tap.merger, l: !!tap.left, r: !!tap.right },
    playing: eng.isPlaying(),
    listenersProbed: lv.length,
  };
});
console.log("engine probe:", JSON.stringify(info));
if (info.found) {
  await page.getByTestId("footer-play-pause").click();
  await page.waitForTimeout(2500);
  const mid = await page.evaluate(() => {
    const eng = window.__eng;
    const tap = eng.getLevelTapNodes();
    const sample = (an) => {
      const a = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(a);
      let mx = 0;
      for (let i = 0; i < a.length; i++) mx = Math.max(mx, Math.abs(a[i]));
      return Math.round(mx * 1000) / 1000;
    };
    return {
      playing: eng.isPlaying(),
      getLevels: eng.getLevels(),
      emitted: window.__lv.length,
      last: window.__lv[window.__lv.length - 1],
      tapL: sample(tap.left),
      tapR: sample(tap.right),
      litL: (() => {
        const r = document.querySelector(
          '[data-testid="footer-peak-pips-left"]'
        );
        return r
          ? [...r.querySelectorAll("span")].filter((s) =>
              /bg-st-ok|bg-st-coral/.test(s.className)
            ).length
          : -1;
      })(),
      litR: (() => {
        const r = document.querySelector(
          '[data-testid="footer-peak-pips-right"]'
        );
        return r
          ? [...r.querySelectorAll("span")].filter((s) =>
              /bg-st-ok|bg-st-coral/.test(s.className)
            ).length
          : -1;
      })(),
    };
  });
  console.log("mid-play:", JSON.stringify(mid));
  await page.screenshot({
    path: `${OUT}/app-09-footer-playing.png`,
    clip: await page.locator("footer").boundingBox(),
  });
  await page.getByTestId("footer-play-pause").click();
}
await browser.close();
console.log("done");
