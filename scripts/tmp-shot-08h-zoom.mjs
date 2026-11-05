// crop the desktop target PNG: header band + footer band at 1x
import { chromium } from "playwright";
import fs from "fs";

const FILE =
  "C:/Programacion/demuxify_v2/view_target/desktop_stitch_target_design.png";
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1400, height: 1200 },
  deviceScaleFactor: 1,
});
await page.setContent(
  `<body style="margin:0"><img src="${`data:image/png;base64,${fs.readFileSync(FILE).toString("base64")}`}" width="1400" style="display:block"/></body>`
);
await page.waitForTimeout(300);
const dims = await page.evaluate(() => {
  const img = document.querySelector("img");
  return {
    nw: img.naturalWidth,
    nh: img.naturalHeight,
    w: img.width,
    h: img.height,
  };
});
console.log("desktop png", dims);
const scale = 1400 / dims.nw;
const imgH = dims.nh * scale;
await page.screenshot({
  path: `${OUT}/mock-desktop-08h-header.png`,
  clip: { x: 0, y: 0, width: 1400, height: 130 },
});
await page.screenshot({
  path: `${OUT}/mock-desktop-08h-footer.png`,
  clip: { x: 0, y: imgH - 130, width: 1400, height: 130 },
});
await page.close();
await browser.close();
