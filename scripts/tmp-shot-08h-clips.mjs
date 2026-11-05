// 08h: header + footer clips at 1440 and 390 from the running app
import { chromium } from "playwright";
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
(async () => {
  const browser = await chromium.launch();
  for (const vw of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width: vw, height: vw === 1440 ? 900 : 844 },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
    });
    await page.goto("https://localhost:5175/#debug", { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const nav = page.locator("[aria-label='Tab Band']");
    for (const btn of await nav.locator("button").all()) {
      if ((await btn.innerText()).toUpperCase().includes("MIX")) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const fgeo = await page.evaluate(() => {
      const r = document.querySelector("footer").getBoundingClientRect();
      return { y: Math.round(r.top), h: Math.round(r.height) };
    });
    console.log(`vw ${vw}: footer y=${fgeo.y} h=${fgeo.h}`);
    await page.screenshot({
      path: `${OUT}/app-08h-header-${vw}.png`,
      clip: { x: 0, y: 0, width: vw, height: 90 },
    });
    await page.screenshot({
      path: `${OUT}/app-08h-footer-${vw}.png`,
      clip: {
        x: 0,
        y: Math.max(0, fgeo.y - 8),
        width: vw,
        height: fgeo.h + 16,
      },
    });
    await page.close();
  }
  await browser.close();
})();
