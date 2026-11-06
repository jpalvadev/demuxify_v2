// Instrumented probe (2026-11-05 preview fix): walks the shipped Signalsmith
// handshake stage-by-stage in `vite preview`: patches addModule to capture
// its promise outcome, catches factory rejection, and listens on the node
// port. Reveals which stage stalls when 'ready' never posts.
// Usage: node scripts/tmp-preview-instrumented-probe.mjs <previewURL> <chunkURL>
import { chromium } from "playwright";

const URL_BASE = process.argv[2] || "https://localhost:4173/";
const CHUNK_URL = process.argv[3];
if (!CHUNK_URL) {
  console.error(
    "usage: node scripts/tmp-preview-instrumented-probe.mjs <previewURL> <chunkURL>"
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
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
page.on("console", (m) =>
  console.log("CONSOLE[" + m.type() + "]:", m.text().slice(0, 300))
);

await page.goto(URL_BASE, { waitUntil: "load", timeout: 30000 });

const report = await page.evaluate(async (chunkUrl) => {
  const log = [];
  const mod = await import(/* @vite-ignore */ chunkUrl);
  const factory = mod.default;
  const ctx = new AudioContext();

  // Stage 1: addModule outcome (resolve/reject + error text)
  const awProto = Object.getPrototypeOf(ctx.audioWorklet);
  if (awProto && awProto.addModule) {
    const orig = awProto.addModule;
    awProto.addModule = function (url) {
      log.push("addModule() called");
      const p = orig.call(this, url);
      p.then(() => log.push("addModule RESOLVED")).catch((e) =>
        log.push("addModule REJECTED: " + String(e).slice(0, 200))
      );
      return p;
    };
  }

  // Stage 2: factory promise
  let stage2;
  const nodeP = factory(ctx, { stretchId: 1, stretchy: true });
  const outcome = await Promise.race([
    nodeP.then((n) => {
      stage2 = "factory RESOLVED with node";
      return n;
    }),
    new Promise((r) => setTimeout(() => r("TIMEOUT-8S"), 8000)).catch(() => {}),
  ]).catch((e) => {
    stage2 = "factory REJECTED: " + String(e).slice(0, 200);
    return null;
  });

  // Stage 3: port traffic for 4 s after node exists
  let portTraffic = "no node";
  if (outcome && outcome.port) {
    const msgs = [];
    const prev = outcome.port.onmessage;
    outcome.port.onmessage = (ev) =>
      msgs.push(JSON.stringify(ev.data).slice(0, 120));
    await new Promise((r) => setTimeout(r, 4000));
    outcome.port.onmessage = prev;
    portTraffic = msgs.length
      ? msgs.join(" | ")
      : "(silent — no messages posted in 4 s)";
  }

  try {
    ctx.close();
  } catch {}
  return { isolated: self.crossOriginIsolated, log, stage2, portTraffic };
}, CHUNK_URL);

console.log("isolated:", report.isolated);
for (const l of report.log) console.log("  " + l);
console.log("factory:", report.stage2);
console.log("port traffic:", report.portTraffic);
await browser.close();
