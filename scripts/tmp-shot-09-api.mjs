// Ticket 09 probe: API surface of Chrome's AudioContext w.r.t. the engine guard.
import { chromium } from "playwright";
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 800 },
  ignoreHTTPSErrors: true,
});
await page.goto("https://localhost:5173/", { waitUntil: "load" });
const out = await page.evaluate(async () => {
  const { StemPlayerEngine } = await import("/src/lib/stemPlayerEngine.ts");
  const ctx = new AudioContext();
  const api = {
    createSplitter: typeof ctx.createSplitter,
    createAnalyser: typeof ctx.createAnalyser,
  };
  const mk = (amp) => {
    const b = ctx.createBuffer(2, 44100 * 2, 44100);
    const L = b.getChannelData(0);
    const R = b.getChannelData(1);
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
  const tap = engine.getLevelTapNodes();
  const master = engine.getMasterGainNode();
  return {
    api,
    splitter: !!tap.splitter,
    left: !!tap.left,
    right: !!tap.right,
    masterConnects: (master.connect.mock?.calls || []).map(
      (c) => c[0]?.constructor?.name || String(c[0])
    ),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
