// Screenshot pass for the Stitch Skin fidelity loop: renders the running app
// (vite dev server) at desktop/mobile viewports plus the stitch.html mockup
// itself via file://. PNGs land in the approved temp dir for the model to read.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const log = console.log;

const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
mkdirSync(OUT, { recursive: true });

const shots = [
  ["app-desktop", "https://localhost:5174/", 1440, 900],
  ["app-mobile", "https://localhost:5174/", 390, 844],
  [
    "mockup-desktop",
    "file:///C:/Programacion/demuxify_v2/stitch.html",
    1440,
    900,
  ],
  [
    "mockup-mobile",
    "file:///C:/Programacion/demuxify_v2/stitch.html",
    390,
    844,
  ],
];

const browser = await chromium.launch();
const page = await browser.newPage({ ignoreHTTPSErrors: true });
for (const [name, url, w, h] of shots) {
  await page.goto(url, { waitUntil: "load" });
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  log(`${name} -> ${OUT}/${name}.png`);
}
await browser.close();
