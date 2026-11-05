// zoom the mobile target PNG footer: wrapper page pins the img at 0,0, 1x and 2x crops
import { chromium } from "playwright";
import fs from "fs";

const FILE =
  "C:/Programacion/demuxify_v2/view_target/mobile_stitch_target_design.png";
const PNG = `data:image/png;base64,${fs.readFileSync(FILE).toString("base64")}`;
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";

const browser = await chromium.launch();

const page = await browser.newPage({
  viewport: { width: 706, height: 1620 },
  deviceScaleFactor: 1,
});
await page.setContent(
  `<body style="margin:0"><img src="${PNG}" width="706" style="display:block"/></body>`
);
await page.waitForTimeout(300);
const top = await page.evaluate(
  () => document.querySelector("img").getBoundingClientRect().top
);
console.log("img top", top);
await page.screenshot({
  path: `${OUT}/mock-mobile-08g-bottom1x.png`,
  clip: { x: 0, y: 1360, width: 706, height: 220 },
});
await page.close();

const pg2 = await browser.newPage({
  viewport: { width: 1412, height: 3100 },
  deviceScaleFactor: 1,
});
await pg2.setContent(
  `<body style="margin:0"><img src="${PNG}" width="1412" style="display:block"/></body>`
);
await pg2.waitForTimeout(300);
await pg2.screenshot({
  path: `${OUT}/mock-mobile-08g-footer-2x.png`,
  clip: { x: 0, y: 2720, width: 1412, height: 380 },
});
await pg2.close();

await browser.close();
