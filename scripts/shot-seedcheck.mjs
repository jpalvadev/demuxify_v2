// Diagnostic: load the app WITH the shot-mix seed and capture window errors.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});

page.on("console", (msg) => {
  const t = typeof msg.type === "function" ? msg.type() : msg.type;
  const x = typeof msg.text === "function" ? msg.text() : msg.text;
  if (t === "error" || t === "warning" || String(x).includes("APPERR"))
    console.log("CONSOLE:", String(x).slice(0, 500));
});
page.on("page_error", (err) =>
  console.log("PAGEERR:", String(err).slice(0, 800))
);

await page.addInitScript(
  `window.addEventListener("error", (e) => { try { console.log("APPERR " + e.message + " @" + (e.filename||"") + ":" + (e.lineno||"")); } catch (_) {} }, true);`
);

const src = await readFile("scripts/shot-mix.mjs", "utf8");
const key = "const seed = " + String.fromCharCode(96);
const start = src.indexOf(key);
const open = start + key.length;
const end = src.indexOf(String.fromCharCode(96), open);
if (start < 0 || end < 0) throw new Error("no seed literal in shot-mix.mjs");
const seed = src.slice(open, end);
await page.addInitScript(seed);

await page.goto("https://localhost:5174/", { waitUntil: "load" });
await page.waitForTimeout(2500);

const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
console.log("body length:", bodyText.length);
if (bodyText.length < 400) console.log("body:", bodyText.slice(0, 400));
await browser.close();
