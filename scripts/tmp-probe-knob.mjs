// Quantitative knob-centering probe: clips each stem slider row at dsf 3,
// paints the clip on an in-page canvas, finds coral thumb pixels, compares
// the thumb band's vertical center against the input element's center.
import { chromium } from "playwright";

const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
const URL = (process.argv[2] || "https://localhost:5174/") + "#debug";
const SCALE = 3;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: SCALE,
  ignoreHTTPSErrors: true,
});
await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(2200);
const nav = page.locator("[aria-label='Tab Band']");
for (const btn of await nav.locator("button").all()) {
  if ((await btn.innerText()).toUpperCase().includes("MIX")) {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(1200);

for (const stem of ["Vocals", "Drums", "Bass", "Other"]) {
  const input = page
    .locator(`[role="group"][aria-label="${stem} Stem"] input[type="range"]`)
    .first();
  const box = await input.boundingBox();
  const clip = {
    x: Math.max(0, box.x - 6),
    y: Math.max(0, box.y - 10),
    width: box.width + 8,
    height: box.height + 20,
  };
  const shot = (await page.screenshot({ clip })).toString("base64");
  const res = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.src = "data:image/png;base64," + b64;
    });
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = 1e9,
      maxX = -1,
      minY = 1e9,
      maxY = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const [r, g, bl] = [d[i], d[i + 1], d[i + 2]];
        // coral #f85153 core + glow band
        if (r > 170 && g < 120 && bl < 130 && r - g > 70) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { minX, maxX, minY, maxY, cw: c.width, ch: c.height };
  }, shot);
  await page.screenshot({ clip, path: `${OUT}/probe-knob-${stem}.png` });
  if (res.maxX < 0) {
    console.log(`${stem}: NO coral pixels found`);
    continue;
  }
  const thumbMid = ((res.minY + res.maxY) / 2 / SCALE + clip.y).toFixed(2);
  const inputMid = (box.y + box.height / 2).toFixed(2);
  const dx = (thumbMid - inputMid).toFixed(2);
  console.log(
    `${stem}: thumbMid=${thumbMid} inputMid=${inputMid} dy=${dx}px` +
      (Math.abs(dx) <= 1.5 ? " CENTERED" : " OFF-CENTER")
  );
}
await browser.close();
