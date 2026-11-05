// Ticket 09 live verification: the footer transport bar's live channels probed
// in the shipped app via Playwright. A synthetic 6 s WAV (loud left, quiet
// right) goes through the real decode path, the real separation pipeline, and
// real playback — the footer clock, peak pips, and Master fader are read from
// the live DOM. Screenshots land in the approved temp dir (never view_target/).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
mkdirSync(OUT, { recursive: true });
const WAV = `${OUT}/probe-09.wav`;

// --- synth WAV: 6 s, 44.1 kHz, 16-bit stereo — L 0.35 @ 440 Hz, R 0.10 @ 440 Hz
const rate = 44100;
const secs = 6;
const n = rate * secs;
const bytes = 44 + n * 4;
const buf = Buffer.alloc(bytes);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + n * 4, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
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
console.log(`probe wav -> ${WAV} (${bytes} bytes)`);

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
page.on("page_error", (err) =>
  console.log("PAGEERR: " + String(err).slice(0, 300))
);

const footer = () => page.locator("footer");
const clockText = async () =>
  (await page.getByTestId("footer-clock").innerText()).replace(/\s+/g, " ");
const pctText = async () =>
  (await page.getByTestId("footer-master-percent").innerText()).trim();
const sliderValue = () => page.getByTestId("footer-master-volume").inputValue();
const litCount = async (testId) =>
  await page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    if (!root) return -1;
    return [...root.querySelectorAll("span")].filter((s) =>
      /bg-st-ok|bg-st-coral/.test(s.className)
    ).length;
  }, testId);

await page.goto("https://localhost:5173/", { waitUntil: "load" });
await page.waitForTimeout(2500);

console.log("== idle footer ==");
console.log("clock:", await clockText());
console.log(
  "pips L/R:",
  await litCount("footer-peak-pips-left"),
  await litCount("footer-peak-pips-right")
);
console.log("pct:", await pctText(), "slider:", await sliderValue());

// --- load the probe WAV through the shipped file path
await page.setInputFiles('input[aria-label="Select Source Mix file"]', WAV);
await page.waitForTimeout(3500);
console.log("clock after decode:", await clockText());

// Ultra Fast profile (Open-Unmix ~35 MB) — the probe needs the pipeline, not
// the heaviest model.
const fast = page.getByText("Ultra Fast", { exact: false }).first();
if (await fast.count()) {
  await fast.click();
  await page.waitForTimeout(500);
}

// --- run the real separation pipeline
const sep = page.getByRole("button", { name: /separate stems/i });
if (await sep.count()) await sep.first().click();
const t0 = Date.now();
let phase = "";
while (Date.now() - t0 < 1200000) {
  // The completion badge is an aria-label, not body text.
  phase = (await page.evaluate(
    () => !!document.querySelector('[aria-label="Separation Complete"]')
  ))
    ? "complete"
    : phase;
  if (phase === "complete") break;
  const err = await page
    .evaluate(() => document.body.innerText)
    .then((x) =>
      /separation (failed|error)/i.test(x)
        ? x.match(/.{0,300}separation (failed|error).{0,300}/i)?.[0]
        : null
    );
  if (err) {
    console.log("SEPARATION PROBLEM:", err.replace(/\n/g, " | ").slice(0, 600));
    break;
  }
  await page.waitForTimeout(5000);
}
console.log(
  "separation phase:",
  phase,
  `(${((Date.now() - t0) / 1000).toFixed(0)} s)`
);
if (phase !== "complete") {
  console.log("ABORT: separation did not complete");
  await browser.close();
  process.exit(1);
}

// --- Mix tab, play, watch the footer live
const band = page.locator("[aria-label='Tab Band']");
const chips = await band.locator("button").all();
for (const chip of chips) {
  if ((await chip.innerText()).toUpperCase().includes("MIX")) {
    await chip.click();
    break;
  }
}
await page.waitForTimeout(1500);

await page.getByTestId("footer-play-pause").click();
await page.waitForTimeout(3000);
console.log("== playing (3 s in) ==");
console.log("clock:", await clockText());
console.log(
  "pips L/R:",
  await litCount("footer-peak-pips-left"),
  await litCount("footer-peak-pips-right")
);
await page.screenshot({
  path: `${OUT}/app-09-footer-playing.png`,
  clip: await footer().boundingBox(),
});
await page.screenshot({ path: `${OUT}/app-09-desktop.png`, fullPage: true });

// --- fader: Home -> 0%, End -> 100%
await page.getByTestId("footer-master-volume").focus();
await page.keyboard.press("Home");
await page.waitForTimeout(400);
console.log(
  "after Home: pct:",
  await pctText(),
  "slider:",
  await sliderValue()
);
await page.keyboard.press("End");
await page.waitForTimeout(400);
console.log(
  "after End:  pct:",
  await pctText(),
  "slider:",
  await sliderValue()
);

// --- pause -> meters fall dark
await page.getByTestId("footer-play-pause").click();
await page.waitForTimeout(1500);
console.log("== paused ==");
console.log("clock:", await clockText());
console.log(
  "pips L/R:",
  await litCount("footer-peak-pips-left"),
  await litCount("footer-peak-pips-right")
);
await page.screenshot({
  path: `${OUT}/app-09-footer-paused.png`,
  clip: await footer().boundingBox(),
});

// --- phone rail with live values
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/app-09-mobile.png`, fullPage: true });
console.log("mobile clock:", await clockText());

await browser.close();

// --- pip ladder probe: the shipped engine sampling on a REAL AnalyserNode,
// in-browser. --mute-audio mutes the audio SINK after the graph's
// MediaStreamAudioDestinationNode, so nothing feeds the app's own
// ctx.destination; destination.contentType = "interactive" keeps the context
// clocking the silent graph. The clock walk above is real-time proof.
const browser2 = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const page2 = await browser2.newPage({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
await page2.goto("https://localhost:5173/", { waitUntil: "load" });
const ladder = await page2.evaluate(async () => {
  const { StemPlayerEngine } = await import("/src/lib/stemPlayerEngine.ts");
  const ctx = new AudioContext();
  await ctx.resume();
  const mk = (amp) => {
    const b = ctx.createBuffer(2, 44100 * 6, 44100);
    const L = b.getChannelData(0);
    const R = b.getChannelData(1);
    for (let i = 0; i < L.length; i++) {
      const s = Math.sin(2 * Math.PI * 440 * (i / 44100));
      L[i] = s * amp;
      R[i] = s * amp * 0.25;
    }
    return b;
  };
  const loud = mk(0.8);
  const quiet = mk(0.0001);
  const stems = { vocals: loud, drums: quiet, bass: quiet, other: quiet };
  const engine = new StemPlayerEngine(stems, {
    audioContext: ctx,
    sampleRate: 44100,
  });
  const tap = engine.getLevelTapNodes();
  if (!tap.left || !tap.right) return { error: "no analysers on real ctx" };
  const emissions = [];
  engine.subscribeLevels((lv) => emissions.push(lv));
  await engine.play();
  const seen = [];
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const lv = engine.getLevels();
    seen.push(
      Math.round(lv.left * 100) / 100,
      Math.round(lv.right * 100) / 100
    );
  }
  engine.pause();
  const paused = engine.getLevels();
  engine.dispose();
  return {
    emissions: emissions.length,
    maxLeft: Math.max(...seen.filter((_, i) => i % 2 === 0)),
    maxRight: Math.max(...seen.filter((_, i) => i % 2 === 1)),
    paused: [
      Math.round(paused.left * 1000) / 1000,
      Math.round(paused.right * 1000) / 1000,
    ],
    clockAdvanced: Math.round(ctx.currentTime * 10) / 10,
  };
});
console.log(
  "== engine sampling on a real AnalyserNode (Chrome, real-time graph) =="
);
console.log(JSON.stringify(ladder));
await browser2.close();
console.log("done");
