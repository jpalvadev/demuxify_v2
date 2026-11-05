// probe: footer cluster geometry at 591 / 442 / 390
import { chromium } from "playwright";

const browser = await chromium.launch();

async function openMix(w, h) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
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
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  return page;
}

for (const w of [591, 480, 442, 390]) {
  const page = await openMix(w, 300);
  const geo = await page.evaluate(() => {
    const f = document.querySelector("footer");
    const kids = [...f.children].map((c) => {
      const r = c.getBoundingClientRect();
      return {
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
    const fr = f.getBoundingClientRect();
    return {
      bar: { w: Math.round(fr.width), h: Math.round(fr.height) },
      kids,
      docScrollW: document.documentElement.scrollWidth,
    };
  });
  console.log(`app @${w}:`, JSON.stringify(geo));
  const clipH = Math.min(geo.bar.h + 24, 300);
  await page.screenshot({
    path: `C:/Users/Lorenzo06/AppData/Local/Temp/opencode/app-${w}-foot3-08f.png`,
    clip: { x: 0, y: 300 - clipH, width: w, height: clipH },
  });
  await page.close();
}

await browser.close();
