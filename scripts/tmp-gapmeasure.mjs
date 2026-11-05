// Untracked temp probe: vertical gaps — band bottom vs first stage card, card vs card (app vs mock).
import { chromium } from "playwright";

const URL = "https://localhost:5174/#debug";

async function shot(label, w, h, url, clickMix) {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    ignoreHTTPSErrors: true,
  });
  await page.goto(url, { waitUntil: "networkidle" });
  if (clickMix) {
    await page.waitForTimeout(2200);
    const nav = page.locator("[aria-label='Tab Band']");
    const buttons = await nav.locator("button").all();
    for (const btn of buttons) {
      if ((await btn.innerText()).toUpperCase().includes("MIX")) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(1200);
  }
  const d = await page.evaluate(() => {
    const band =
      document.querySelector("[aria-label='Tab Band']") ||
      document.querySelector("header");
    const bandBottom = band
      ? Math.round(band.getBoundingClientRect().bottom)
      : null;
    let host =
      document.querySelector("[class*='inset-0']") ||
      document.querySelector("main");
    const kids = host
      ? Array.from(host.children)
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 50 && r.height > 20)
      : [];
    const firstTop = kids.length ? Math.round(kids[0].top) : null;
    const gaps = [];
    for (let i = 1; i < kids.length; i++)
      gaps.push(Math.round(kids[i].top - kids[i - 1].bottom));
    return { bandBottom, firstTop, gaps: gaps.slice(0, 4) };
  });
  console.log(
    label,
    `vw=${w} bandBottom=${d.bandBottom} firstCardTop=${d.firstTop} headroom=${d.firstTop !== null && d.bandBottom !== null ? d.firstTop - d.bandBottom : "?"} childGaps=${JSON.stringify(d.gaps)}`
  );
  await page.close();
  await browser.close();
}

await shot("APP", 1440, 1100, URL, true);
await shot(
  "MOCK",
  1440,
  1100,
  "file:///C:/Programacion/demuxify_v2/view_target/stitch.html",
  false
);
await shot("APP", 390, 1100, URL, true);
await shot(
  "MOCK",
  390,
  1100,
  "file:///C:/Programacion/demuxify_v2/view_target/stitch.html",
  false
);
