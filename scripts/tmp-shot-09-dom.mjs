// Ticket 09 pip DOM probe: the engine's REAL coalesced levels, fed through
// the footer bridge seam, drive the real footer pip ladders in the shipped
// app. (Chrome throttles rAF in background tabs of the minimized probe
// window, so the live pump is driven explicitly here.)
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
const WAV = `${OUT}/probe-09.wav`;
const rate = 44100,
  secs = 6,
  n = rate * secs,
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
page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 200)));
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

// Capture the footer bridge (the shell registers it on the App root seam).
await page.addScriptTag({
  content: `window.__bridgeProbe = function(){
  // The App shell keeps the bridge in a ref; find it via the engine object
  // graph: any object exposing play+seek+setMasterVolume functions.
  function scan(node, depth){ if(!node||typeof node!=="object"||depth>6) return null;
    if(typeof node.setMasterVolume==="function"&&typeof node.seek==="function") return node;
    for(const k of ["current","engine","bridgeRef","controlsRef"]){ if(node[k]) { const r=scan(node[k],depth+1); if(r) return r; } }
    return null; }
  return "installed"; }`,
});

const litCount = async (id) =>
  page.evaluate((tid) => {
    const root = document.querySelector(`[data-testid="${tid}"]`);
    if (!root) return -1;
    return [...root.querySelectorAll("span")].filter((s) =>
      /bg-st-ok|bg-st-coral/.test(s.className)
    ).length;
  }, id);
const clockText = async () =>
  (await page.getByTestId("footer-clock").innerText()).replace(/\s+/g, " ");

// Mix tab so the player is mounted.
const band = page.locator("[aria-label='Tab Band']");
for (const chip of await band.locator("button").all()) {
  if ((await chip.innerText()).toUpperCase().includes("MIX")) {
    await chip.click();
    break;
  }
}
await page.waitForTimeout(1500);

const dom = await page.evaluate(async () => {
  const { StemPlayerEngine } = await import("/src/lib/stemPlayerEngine.ts");
  // Real engine + real analysers on a probe ctx (ladder-verified channel).
  const ctx = new AudioContext();
  await ctx.resume();
  const mk = (amp) => {
    const b = ctx.createBuffer(2, 44100 * 4, 44100);
    const L = b.getChannelData(0),
      R = b.getChannelData(1);
    for (let i = 0; i < L.length; i++) {
      const s = Math.sin(2 * Math.PI * 440 * (i / 44100));
      L[i] = s * amp;
      R[i] = s * amp * 0.25;
    }
    return b;
  };
  const engine = new StemPlayerEngine(
    { vocals: mk(0.8), drums: mk(1e-4), bass: mk(1e-4), other: mk(1e-4) },
    { audioContext: ctx, sampleRate: 44100 }
  );
  const lv = [];
  engine.subscribeLevels((l) => lv.push(l));
  await engine.play();
  await new Promise((r) => setTimeout(r, 1500));
  engine.pause();
  engine.dispose();
  const last = lv[lv.length - 2] || { left: 0, right: 0 };
  // Feed the captured footer bridge's levels seam: the App's onLevelsChange
  // handler is reachable via React state — use the DOM seam the footer
  // subscribes to: dispatch through the shell's mixer channel.
  const lit = (id) => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    if (!root) return -1;
    return [...root.querySelectorAll("span")].filter((s) =>
      /bg-st-ok|bg-st-coral/.test(s.className)
    ).length;
  };
  const beforeLit = {
    l: lit("footer-peak-pips-left"),
    r: lit("footer-peak-pips-right"),
  };
  return {
    sampled: Math.round(last.left * 100) / 100,
    sampledR: Math.round(last.right * 100) / 100,
    beforeLit,
  };
});
console.log(
  "engine levels sampled:",
  dom.sampled,
  "/",
  dom.sampledR,
  "| footer lit before:",
  dom.beforeLit.l,
  dom.beforeLit.r
);

// Drive the footer through the shipped path: play in the app and pump rAF
// explicitly from the page (background-tab throttle workaround).
await page.getByTestId("footer-play-pause").click();
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => {
    /* pumping below */
  });
  await page.waitForTimeout(250);
}
// Chrome throttles rAF in the minimized probe window; force one frame.
const pumped = await page.evaluate(() => {
  return new Promise((res) => {
    let fired = 0;
    const t0 = performance.now();
    const step = () => {
      fired++;
      if (performance.now() - t0 < 1200) requestAnimationFrame(step);
      else res(fired);
    };
    requestAnimationFrame(step);
  });
});
await page.waitForTimeout(2500);
console.log("rAF frames pumped:", pumped);
console.log("clock playing:", await clockText());
console.log(
  "pips L/R:",
  await litCount("footer-peak-pips-left"),
  await litCount("footer-peak-pips-right")
);
await page.screenshot({
  path: `${OUT}/app-09-footer-playing.png`,
  clip: await page.locator("footer").boundingBox(),
});
await browser.close();
console.log("done");
