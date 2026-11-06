// Stage probe v2 (2026-11-05 preview fix): factory-attempt timeout forensics —
// unhandled rejections, manual AudioWorkletNode retry, port snooping.
// Usage: node scripts/tmp-preview-stage-probe.mjs <previewURL> <chunkURL>
import { chromium } from "playwright";

const URL_BASE = process.argv[2] || "https://localhost:4173/";
const CHUNK_URL = process.argv[3];
if (!CHUNK_URL) {
  console.error(
    "usage: node scripts/tmp-preview-stage-probe.mjs <previewURL> <chunkURL>"
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
  self.addEventListener("unhandledrejection", (e) =>
    L.push("UNHANDLED REJECTION: " + String(e.reason).slice(0, 300))
  );
  const mod = await import(/* @vite-ignore */ chunkUrl);
  const factory = mod.default;
  const ctx = new AudioContext();
  const KEY = "signalsmith-stretch";

  // 1) factory attempt
  let node = null;
  const attempt = await Promise.race([
    factory(ctx, { stretchId: 1, stretchy: true }).then((n) => {
      node = n;
      return "factory RESOLVED";
    }),
    new Promise((r) => setTimeout(() => r("factory PENDING (8 s)"), 8000)),
  ]).catch((e) => "factory REJECTED: " + String(e).slice(0, 300));
  L.push("1) " + attempt);

  // 2) does the AudioWorkletNode exist under the key at all?
  try {
    const probeNode = new AudioWorkletNode(ctx, KEY, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    L.push("2) manual AudioWorkletNode OK (processor registered)");
    const msgs = [];
    probeNode.port.onmessage = (ev) =>
      msgs.push(JSON.stringify(ev.data).slice(0, 100));
    await new Promise((r) => setTimeout(r, 3000));
    L.push(
      "3) manual node port: " +
        (msgs.length ? msgs.join(" | ") : "(silent 3 s)")
    );
  } catch (e) {
    L.push("2) manual AudioWorkletNode THREW: " + String(e).slice(0, 200));
  }

  // 4) inspect the per-context addModule promise state
  const pk = Object.getOwnPropertySymbols(ctx);
  L.push(
    "4) ctx symbols: " +
      pk
        .map((s) => {
          const v = ctx[s];
          return (
            (s.description || "sym") +
            "=" +
            (v && v.then
              ? "promise" + (v.status || "")
              : String(v).slice(0, 60))
          );
        })
        .join(", ")
  );

  if (node) {
    const msgs = [];
    node.port.onmessage = (ev) =>
      msgs.push(JSON.stringify(ev.data).slice(0, 100));
    await new Promise((r) => setTimeout(r, 2000));
    L.push(
      "5) factory node port: " +
        (msgs.length ? msgs.join(" | ") : "(silent 2 s)")
    );
  }

  try {
    ctx.close();
  } catch {}
  return { isolated: self.crossOriginIsolated, L };
}, CHUNK_URL);

console.log("isolated:", report.isolated);
for (const l of report.L) console.log("  " + l);
await browser.close();
