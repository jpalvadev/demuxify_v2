// Find what overflows horizontally at mobile width (debug mode on).
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  ignoreHTTPSErrors: true,
});
await page.goto("https://localhost:5174/#debug", { waitUntil: "load" });
await page.waitForTimeout(1800);
const report = await page.evaluate(() => {
  const vw = window.innerWidth;
  const offenders = [];
  const walk = (el) => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      const cs = getComputedStyle(el);
      offenders.push({
        tag: el.tagName,
        cls: (el.className ?? "").toString().slice(0, 90),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
    for (const child of el.children) walk(child);
  };
  if (document.body) walk(document.body);
  return {
    scrollWidth: document.documentElement.scrollWidth,
    vw,
    offenders: offenders.slice(0, 12),
  };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
