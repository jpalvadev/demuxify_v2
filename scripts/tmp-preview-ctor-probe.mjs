// Construction forensics probe (2026-11-05 preview fix): wraps global
// AudioWorkletNode to record every construction attempt (throws included),
// attaches a port listener at construction time, and logs addModule, so a
// factory handshake hang can be pinned to a specific construction.
// Usage: node scripts/tmp-preview-ctor-probe.mjs <previewURL> <chunkURL>
import { chromium } from "playwright";

const URL_BASE = process.argv[2] || "https://localhost:4173/";
const CHUNK_URL = process.argv[3];
if (!CHUNK_URL) {
  console.error(
    "usage: node scripts/tmp-preview-ctor-probe.mjs <previewURL> <chunkURL>"
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
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 400)));
page.on(
  "console",
  (m) =>
    m.type() !== "debug" &&
    console.log("CONSOLE[" + m.type() + "]:", m.text().slice(0, 400))
);

await page.goto(URL_BASE, { waitUntil: "load", timeout: 30000 });

const report = await page.evaluate(async (chunkUrl) => {
  const L = [];
  const t0 = performance.now();
  const stamp = () => Math.round(performance.now() - t0);

  self.addEventListener("unhandledrejection", (e) =>
    L.push(`${stamp()}ms UNHANDLED: ${String(e.reason).slice(0, 250)}`)
  );

  const RealNode = self.AudioWorkletNode;
  let ctorCount = 0;
  self.AudioWorkletNode = function (ctx, name, opts) {
    ctorCount++;
    const n = ctorCount;
    L.push(
      `${stamp()}ms ctor#${n} name="${name}" opts=${JSON.stringify(opts).slice(0, 120)}`
    );
    try {
      const node = new RealNode(ctx, name, opts);
      L.push(`${stamp()}ms ctor#${n} OK`);
      // addEventListener survives the library's onmessage assignment
      node.port.addEventListener("message", (ev) =>
        L.push(
          `${stamp()}ms ctor#${n} PORT: ${JSON.stringify(ev.data).slice(0, 120)}`
        )
      );
      node.port.start();
      return node;
    } catch (e) {
      L.push(`${stamp()}ms ctor#${n} THREW: ${String(e).slice(0, 160)}`);
      throw e;
    }
  };
  self.AudioWorkletNode.prototype = RealNode.prototype;

  const mod = await import(/* @vite-ignore */ chunkUrl);
  const factory = mod.default;
  const ctx = new AudioContext();

  const awProto = Object.getPrototypeOf(ctx.audioWorklet);
  const origAdd = awProto.addModule;
  awProto.addModule = function (url) {
    L.push(`${stamp()}ms addModule(${String(url).slice(0, 60)})`);
    const p = origAdd.call(this, url);
    p.then(() => L.push(`${stamp()}ms addModule RESOLVED`)).catch((e) =>
      L.push(`${stamp()}ms addModule REJECTED: ${String(e).slice(0, 200)}`)
    );
    return p;
  };

  const outcome = await Promise.race([
    factory(ctx, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    })
      .then((node) => {
        L.push(`${stamp()}ms factory RESOLVED node=${!!node}`);
        return node;
      })
      .catch((e) => {
        L.push(`${stamp()}ms factory REJECTED: ${String(e).slice(0, 250)}`);
        return null;
      }),
    new Promise((r) => setTimeout(() => r(null), 10000)).then(() => {
      L.push(`${stamp()}ms factory PENDING after 10 s`);
      return null;
    }),
  ]);

  try {
    ctx.close();
  } catch {}
  return L;
}, CHUNK_URL);

for (const l of report) console.log("  " + l);
await browser.close();
