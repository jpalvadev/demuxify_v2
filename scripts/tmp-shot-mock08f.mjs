// probe: mock stitch.html footer renders at 591 and 390
import { chromium } from "playwright";
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";

const browser = await chromium.launch();

for (const w of [591, 390]) {
  const page = await browser.newPage({
    viewport: { width: w, height: 300 },
    deviceScaleFactor: 1,
  });
  await page.goto(
    "file:///C:/Programacion/demuxify_v2/view_target/stitch.html",
    { waitUntil: "load" }
  );
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const f = document.querySelector("footer");
    const r = f.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      h: Math.round(r.height),
      docH: Math.round(document.documentElement.scrollHeight),
      kids: [...f.children].map((c) => {
        const b = c.getBoundingClientRect();
        return {
          x: Math.round(b.left),
          y: Math.round(b.top),
          w: Math.round(b.width),
          h: Math.round(b.height),
        };
      }),
    };
  });
  console.log(`mock footer @ ${w}:`, JSON.stringify(info));
  const y = Math.max(0, info.top - 12);
  await page.screenshot({
    path: `${OUT}/mock-${w}-foot2-08f.png`,
    clip: { x: 0, y, width: w, height: Math.min(info.h + 24, 300 - y) },
  });
  await page.close();
}

await browser.close();
