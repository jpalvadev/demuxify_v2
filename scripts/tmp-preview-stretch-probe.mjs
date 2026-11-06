// Live probe (2026-11-05 preview fix): the production build's Signalsmith
// Stretch worklet handshake, probed against `vite preview`. Dev-only
// optimizeDeps.exclude never guards the Rollup build; the default build
// target lowered class fields to a module-scope helper absent in the worklet
// blob, the constructor threw, the 'ready' handshake hung, and playback
// silently degraded to WSOLA/playbackRate (pitch coupling). This probe
// imports the SHIPPED hashed chunk, runs the real factory handshake, and
// captures every page/worklet error. PASS = AudioWorkletNode resolves with a
// live port and zero worklet ReferenceErrors.
// Usage: node scripts/tmp-preview-stretch-probe.mjs <previewURL> <chunkURLPath>
import { chromium } from "playwright";

const URL_BASE = process.argv[2] || "https://localhost:4173/";
const CHUNK_URL = process.argv[3];
if (!CHUNK_URL) {
  console.error(
    "usage: node scripts/tmp-preview-stretch-probe.mjs <previewURL> </assets/SignalsmithStretch-*.js>"
  );
  process.exit(2);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--mute-audio",
    "--ignore-certificate-errors",
  ],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
const errors = [];
page.on("pageerror", (err) =>
  errors.push("PAGEERROR: " + String(err).slice(0, 300))
);
page.on("console", (msg) => {
  if (msg.type() === "error")
    errors.push("CONSOLE: " + msg.text().slice(0, 300));
});

await page.goto(URL_BASE, { waitUntil: "load", timeout: 30000 });

const probe = await page.evaluate(async (chunkUrl) => {
  const isolated = self.crossOriginIsolated;
  const mod = await import(/* @vite-ignore */ chunkUrl);
  const factory = mod.default;
  if (typeof factory !== "function")
    return { isolated, ok: false, why: "chunk has no default factory fn" };
  const ctx = new AudioContext();
  const DEADLINE_MS = 8000;
  const started = performance.now();
  const outcome = await Promise.race([
    factory(ctx, { stretchId: 1, stretchy: true }).then((node) => ({
      ok: !!node && !!node.port,
      why: "handshake completed",
      ms: Math.round(performance.now() - started),
    })),
    new Promise((res) =>
      Promise.resolve().then(() => {
        const h = new Promise((r2) => {
          const id = setTimeout(
            () =>
              r2({
                ok: false,
                why: "handshake timeout (ready never posted)",
                ms: DEADLINE_MS,
              }),
            DEADLINE_MS
          );
          void id;
        });
        res(h);
      })
    ),
  ]);
  try {
    ctx.close();
  } catch {
    /* noop */
  }
  return { isolated, ...outcome };
}, CHUNK_URL);

console.log("URL:", URL_BASE, "chunk:", CHUNK_URL);
console.log("PROBE:", JSON.stringify(probe, null, 2));
console.log("ERRORS SEEN:", errors.length);
for (const e of errors) console.log("  " + e);
const clean = errors.length === 0 && probe.ok;
console.log(
  clean
    ? "PASS: worklet handshake live in preview, zero errors"
    : "FAIL: see PROBE/ERRORS above"
);
await browser.close();
process.exit(clean ? 0 : 1);
