// Throwaway: crop the stem-card zone out of the mobile VIEW TARGET PNG and
// out of the current app mobile shot, at 3x, for direct margin comparison.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 900, height: 500 },
  deviceScaleFactor: 3,
});
for (const [src, name, clip] of [
  [
    "C:/Programacion/demuxify_v2/view_target/mobile_stitch_target_design.png",
    "zoom-target-card",
    { x: 12, y: 300, width: 366, height: 170 },
  ],
  [
    OUT + "/app-mix-mobile.png",
    "zoom-app-card",
    { x: 12, y: 330, width: 366, height: 170 },
  ],
]) {
  const b64 = readFileSync(src).toString("base64");
  await page.evaluate(async (b64) => {
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.src = "data:image/png;base64," + b64;
    });
    img.style.cssText =
      "position:fixed;top:0;left:0;width:390px;height:844px;image-rendering:auto;";
    document.body.appendChild(img);
  }, b64);
  await page.screenshot({ path: `${OUT}/${name}.png`, clip });
  console.log(`${name} -> ${OUT}/${name}.png`);
}
await browser.close();
