// Untracked temp probe: mock/app band + stage content insets at desktop and mobile.
import { chromium } from "playwright";

async function shot(url, label, w) {
  const browser = await chromium.launch({});
  const ctx = await browser.newContext({
    viewport: { width: w, height: w < 700 ? 844 : 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const d = await page.evaluate(() => {
    const g = (q) => {
      const el = document.querySelector(q);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width) };
    };
    return {
      vw: window.innerWidth,
      band: g("[aria-label='Tab Band']") || g("header"),
      bandGroup: g("header > div") || g("nav"),
      brand: g("[data-testid='brand-unit-mark']") || g("div div div div"),
      brandWrapNav: (() => {
        const nav =
          document.querySelector("[aria-label='Mode Navigation']") ||
          document.querySelector("nav");
        if (!nav) return null;
        const r = nav.getBoundingClientRect();
        return { x: Math.round(r.x), w: Math.round(r.width) };
      })(),
      stage: (() => {
        const main = document.querySelector("main");
        const first = main && main.querySelector("section, div, h1, h2");
        if (!first) return null;
        const r = first.getBoundingClientRect();
        return { x: Math.round(r.x), w: Math.round(r.width) };
      })(),
    };
  });
  const f = (k, o) =>
    console.log(
      `${k} ${o ? `x=${o.x} right=${o.x + o.w} w=${o.w}` : "MISSING"}`
    );
  console.log(label, "vw:", d.vw);
  f("band", d.band);
  f("bandGroup", d.bandGroup);
  f("brand", d.brand);
  f("chipsContainer", d.brandWrapNav);
  f("stageFirst", d.stage);
  await page.close();
  await browser.close();
}

await shot(process.env.APP_URL || "https://localhost:5174/#debug", "APP", 1440);
await shot(
  "file:///C:/Programacion/demuxify_v2/view_target/stitch.html",
  "MOCK",
  1440
);
await shot(process.env.APP_URL || "https://localhost:5174/#debug", "APP", 390);
await shot(
  "file:///C:/Programacion/demuxify_v2/view_target/stitch.html",
  "MOCK",
  390
);
