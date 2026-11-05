// Mock paint probe: the readings-grid chips' computed styles in view_target/stitch.html.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("file:///C:/Programacion/demuxify_v2/view_target/stitch.html", {
  waitUntil: "load",
});
await page.waitForTimeout(1200);

function probe() {
  const btns = [...document.querySelectorAll("button")].filter(
    (b) => /BPM/.test(b.textContent) && /%/.test(b.textContent)
  );
  const sample = btns.slice(0, 4).map((b) => {
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const spans = [...b.querySelectorAll("span")].map(
      (s) => `${s.textContent.trim()} ${getComputedStyle(s).color}`
    );
    return {
      text: b.textContent.replace(/\s+/g, " ").trim(),
      x: Math.round(r.x),
      w: Math.round(r.width),
      h: Math.round(r.height),
      pad: cs.padding,
      gap: cs.gap,
      justify: cs.justifyContent,
      border: `${cs.borderTopWidth} ${cs.borderTopColor}`,
      bg: cs.backgroundColor,
      color: cs.color,
      radius: cs.borderRadius,
      spans,
    };
  });
  const grid = btns[0] ? btns[0].parentElement : null;
  const gridCs = grid ? getComputedStyle(grid) : null;
  const gridR = grid ? grid.getBoundingClientRect() : null;
  return {
    count: btns.length,
    sample,
    grid: gridCs && {
      display: gridCs.display,
      cols: gridCs.gridTemplateColumns,
      w: Math.round(gridR.width),
      h: Math.round(gridR.height),
      pad: gridCs.padding,
      gap: gridCs.gap,
      border: `${gridCs.borderTopWidth} ${gridCs.borderTopStyle} ${gridCs.borderTopColor}`,
      bg: gridCs.backgroundColor,
    },
  };
}
console.log(JSON.stringify(await page.evaluate(probe), null, 1));
await browser.close();
