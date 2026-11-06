// Throwaway: vertical profile scan of the mobile VIEW TARGET PNG around the
// Vocals stem card — card bands, wave box edges, slider line, knob center.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const PNG =
  "C:/Programacion/demuxify_v2/view_target/mobile_stitch_target_design.png";
const S = 706 / 390; // PNG px per CSS px
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
await page.goto("about:blank");
const out = await page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((r) => {
    img.onload = r;
    img.src = "data:image/png;base64," + b64;
  });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const S = img.width / 390;
  const px = (x, y) => {
    const d = ctx.getImageData(Math.round(x * S), Math.round(y * S), 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const rows = [];
  for (let y = 300; y <= 440; y += 0.5) {
    let purple = 0,
      coral = 0,
      line = 0,
      bright = 0,
      n = 0;
    for (let x = 30; x <= 310; x += 1) {
      const [r, g, b] = px(x, y);
      n++;
      if (r > 120 && b > 170 && r - g > 40) purple++;
      if (r > 170 && g < 120 && r - g > 70) coral++;
      const L = (r + g + b) / 3;
      if (L > 34 && L < 70 && b >= r) line++;
      if (L > 70) bright++;
    }
    rows.push([y, purple, coral, line, bright]);
  }
  // knob cluster + line rows near right end
  let ky0 = 1e9,
    ky1 = -1,
    lx0 = 1e9,
    lx1 = -1;
  for (let y = 300; y <= 440; y += 0.5) {
    for (let x = 315; x <= 375; x += 1) {
      const [r, g, b] = px(x, y);
      if (r > 170 && g < 120 && r - g > 70) {
        ky0 = Math.min(ky0, y);
        ky1 = Math.max(ky1, y);
      }
      const L = (r + g + b) / 3;
      if (L > 34 && L < 75 && b >= r) {
        lx0 = Math.min(lx0, y);
        lx1 = Math.max(lx1, y);
      }
    }
  }
  return { rows, ky0, ky1, lx0, lx1 };
}, readFileSync(PNG).toString("base64"));

console.log(`knob y ${out.ky0}..${out.ky1} mid ${(out.ky0 + out.ky1) / 2}`);
console.log(`line  y ${out.lx0}..${out.lx1} mid ${(out.lx0 + out.lx1) / 2}`);
const bands = [];
let prev = "";
for (const [y, p, c, l, b] of out.rows) {
  const n = 281;
  const band =
    c > 3
      ? "KNOB"
      : p > n * 0.15
        ? "WAVE"
        : b > n * 0.25
          ? "TEXT/BORDER"
          : l > n * 0.3
            ? "LINE"
            : "surface";
  if (band !== prev) {
    bands.push([y, band]);
    prev = band;
  }
}
console.log("band transitions (CSS y):", JSON.stringify(bands));
await browser.close();
