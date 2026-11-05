// Untracked temp probe: header band children rects with class prefixes (app vs mock).
import { chromium } from "playwright";

async function shot(url, label, w) {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: w, height: 1100 },
    ignoreHTTPSErrors: true,
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const d = await page.evaluate(() => {
    const band =
      document.querySelector("[aria-label='Tab Band']") ||
      document.querySelector("header");
    if (!band) return [];
    const walk = (el, depth) => {
      const b = el.getBoundingClientRect();
      const cls = (el.getAttribute("class") || "").slice(0, 46);
      const kids = [];
      if (depth < 2)
        for (const k of Array.from(el.children))
          kids.push(...walk(k, depth + 1));
      return [
        `${cls} h=${Math.round(b.height)} t=${Math.round(b.top)} b=${Math.round(b.bottom)}`,
        ...kids,
      ];
    };
    return walk(band, 0);
  });
  console.log(label, `vw=${w}`);
  for (const line of d) console.log("  ", line);
  await page.close();
  await browser.close();
}

await shot(process.env.APP_URL || "https://localhost:5174/#debug", "APP", 1440);
await shot(
  "file:///C:/Programacion/demuxify_v2/view_target/stitch.html",
  "MOCK",
  1440
);
