import * as fs from "fs";
import { chromium } from "playwright";

const url = "file:///C:/Programacion/demuxify_v2/view_target/stitch.html";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500); // the mock pulls the Tailwind CDN at runtime

const rows = await page.evaluate(() => {
  const all = document.querySelectorAll("div");
  const grid = [...all].find((d) => {
    const c = d.getAttribute("class") || "";
    return (
      c.includes("grid-cols-1") &&
      c.includes("md:grid-cols-4") &&
      c.includes("pt-1") &&
      c.includes("font-mono")
    );
  });
  if (!grid) return null;
  const out = { gridClass: grid.getAttribute("class"), chips: [] };
  for (const chip of grid.querySelectorAll(":scope > div")) {
    const r = chip.getBoundingClientRect();
    out.chips.push({
      w: Math.round(r.width),
      h: Math.round(r.height),
      cls: chip.getAttribute("class"),
      spans: [...chip.querySelectorAll("span")].map((s) => {
        const sr = s.getBoundingClientRect();
        return {
          h: Math.round(sr.height),
          fontSize: getComputedStyle(s).fontSize,
          txt: s.textContent.trim(),
        };
      }),
    });
  }
  return out;
});

console.log(JSON.stringify(rows, null, 1));
await browser.close();
