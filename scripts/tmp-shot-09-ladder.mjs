// Ticket 09 pip-ladder probe: the shipped engine's analyser sampling verified
// on a REAL AnalyserNode in real Chrome (real-time graph, real samples).
import { chromium } from "playwright";

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
  // The pump is listener-gated (idle subscribers mean zero work) — subscribe
  // like the footer does, then read coalesced emissions at the seam.
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
