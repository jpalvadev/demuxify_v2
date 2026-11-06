// Blob-capture probe (2026-11-05 preview fix): intercepts URL.createObjectURL
// in the page, runs the shipped Signalsmith factory against a real
// AudioContext, and dumps the exact worklet module source the shipped chunk
// serializes (the `(_scriptName=>...)()` Blob text) plus any worklet-scope
// errors. Usage: node scripts/tmp-preview-blob-capture.mjs <previewURL> <chunkURL>
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const URL_BASE = process.argv[2] || "https://localhost:4173/";
const CHUNK_URL = process.argv[3];
if (!CHUNK_URL) {
  console.error(
    "usage: node scripts/tmp-preview-blob-capture.mjs <previewURL> <chunkURL>"
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

const out = await page.evaluate(async (chunkUrl) => {
  // Capture every Blob handed to createObjectURL before the factory runs.
  const blobs = [];
  const orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (obj) => {
    const url = orig(obj);
    blobs.push({
      url,
      type: obj?.type,
      size: obj?.size,
      text: obj instanceof Blob ? obj.text() : Promise.resolve("<not a Blob>"),
    });
    return url;
  };
  const mod = await import(/* @vite-ignore */ chunkUrl);
  const factory = mod.default;
  const ctx = new AudioContext();
  let outcome;
  try {
    outcome = await Promise.race([
      factory(ctx, { stretchId: 1, stretchy: true }).then((n) => ({
        ok: !!n && !!n.port,
        why: "handshake completed",
      })),
      new Promise((r) =>
        setTimeout(() => r({ ok: false, why: "timeout" }), 8000)
      ),
    ]);
  } catch (e) {
    outcome = { ok: false, why: "factory threw: " + String(e).slice(0, 200) };
  }
  const texts = [];
  for (const b of blobs) texts.push(await b.text);
  try {
    ctx.close();
  } catch {
    /* noop */
  }
  return {
    isolated: self.crossOriginIsolated,
    outcome,
    blobCount: blobs.length,
    texts,
  };
}, CHUNK_URL);

writeFileSync(
  "C:/Users/Lorenzo06/AppData/Local/Temp/opencode/preview-worklet-blob.js",
  out.texts.join("\n/* ---BLOB--- */\n")
);
console.log("isolated:", out.isolated);
console.log("outcome:", JSON.stringify(out.outcome));
console.log("blobs captured:", out.blobCount);
const blob = out.texts[0] || "";
console.log("blob length:", blob.length);
console.log("blob head:", JSON.stringify(blob.slice(0, 220)));
// Self-containedness checks on the serialized program text.
console.log(
  "blob refs __publicField-ish v(this,:",
  (blob.match(/\bv\(this,/g) || []).length
);
console.log(
  "blob refs _scriptName:",
  (blob.match(/_scriptName/g) || []).length
);
console.log("errors seen:", errors.length);
for (const e of errors) console.log("  " + e);
await browser.close();
