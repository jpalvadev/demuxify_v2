// Mock card facts: the phantom Click Track / Metronome card in view_target/stitch.html.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("file:///C:/Programacion/demuxify_v2/view_target/stitch.html", {
  waitUntil: "load",
});
await page.waitForTimeout(1200);

function probe() {
  const span = [...document.querySelectorAll("span")].find((s) =>
    s.textContent.includes("Click Track / Metronome")
  );
  if (!span) return { reason: "no span" };
  const chain = [];
  let node = span.parentElement;
  for (let i = 0; node && i < 4; i = i + 1) {
    const cs = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    chain.push({
      cls: node.getAttribute("class"),
      box: `x${Math.round(r.x)} y${Math.round(r.y)} w${Math.round(r.width)} h${Math.round(r.height)}`,
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      radius: cs.borderRadius,
      bg: cs.backgroundColor,
      pad: cs.padding,
      gap: cs.gap,
      justify: cs.justifyContent,
      align: cs.alignItems,
      height: cs.height,
    });
    node = node.parentElement;
  }
  const btns = [...document.querySelectorAll("div")].filter(
    (b) =>
      b.getAttribute("class") &&
      b.getAttribute("class").includes("justify-between") &&
      /BPM/.test(b.textContent) &&
      b.textContent.includes("%")
  );
  const chip = btns[0];
  const chipCs = chip ? getComputedStyle(chip) : null;
  const chipR = chip ? chip.getBoundingClientRect() : null;
  const grid = chip ? chip.parentElement : null;
  const gridCs = grid ? getComputedStyle(grid) : null;
  const gridR = grid ? grid.getBoundingClientRect() : null;
  return {
    chain,
    chips: btns.map((b) => {
      const r = b.getBoundingClientRect();
      return `x${Math.round(r.x)} w${Math.round(r.width)} h${Math.round(r.height)} "${b.textContent.replace(/\s+/g, " ").trim()}"`;
    }),
    chip: chip && {
      pad: chipCs.padding,
      gap: chipCs.gap,
      justify: chipCs.justifyContent,
      border: `${chipCs.borderTopWidth} ${chipCs.borderTopStyle} ${chipCs.borderTopColor}`,
      radius: chipCs.borderRadius,
      bg: chipCs.backgroundColor,
      box: `x${Math.round(chipR.x)} w${Math.round(chipR.width)} h${Math.round(chipR.height)}`,
    },
    grid: grid && {
      cls: grid.getAttribute("class"),
      cols: gridCs.gridTemplateColumns,
      gap: gridCs.gap,
      pad: gridCs.padding,
      border: `${gridCs.borderTopWidth} ${gridCs.borderTopStyle} ${gridCs.borderTopColor}`,
      box: `x${Math.round(gridR.x)} y${Math.round(gridR.y)} w${Math.round(gridR.width)} h${Math.round(gridR.height)}`,
    },
  };
}
console.log(JSON.stringify(await page.evaluate(probe), null, 1));
await browser.close();
