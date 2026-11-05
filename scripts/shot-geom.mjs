// Geometry probe at mobile #debug: rects + computed overflow for stage host,
// active panel, master card, tap strip.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  ignoreHTTPSErrors: true,
});
await page.goto("https://localhost:5174/#debug", { waitUntil: "load" });
await page.waitForTimeout(2200);
const nav = page.locator("[aria-label='Tab Band']");
const buttons = await nav.locator("button").all();
for (const btn of buttons) {
  if ((await btn.innerText()).toUpperCase().includes("MIX")) {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(900);
const report = await page.evaluate(() => {
  const q = (sel) => document.querySelector(sel);
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      ovY: cs.overflowY,
      pos: cs.position,
    };
  };
  const stageHost = q("[data-stage-host], div.relative");
  const allDivs = [...document.querySelectorAll("div")];
  const host = allDivs.find((d) => {
    const c = d.getAttribute("class") || "";
    return c.includes("relative") && c.includes("flex-1");
  });
  const panel = allDivs.find((d) => {
    const c = d.getAttribute("class") || "";
    return c.includes("inset-0") && c.includes("overflow-y-auto");
  });
  const strip = q("[data-testid='click-tap-calibration-strip']");
  const mixRegion = [...document.querySelectorAll("*")].find(
    (d) => (d.getAttribute("aria-label") || "") === "Mix Tab"
  );
  return {
    vw: window.innerWidth,
    scrollW: document.documentElement.scrollWidth,
    host: rect(host),
    panel: rect(panel),
    mixRegion: rect(mixRegion),
    strip: rect(strip),
    main: rect(q("main")),
  };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
