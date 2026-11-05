// probe: the mock stitch.html footer at 591x120 (user's crop dims) + app footer
import { chromium } from "playwright";
const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";

const browser = await chromium.launch();

// mock at the crop width
const mock = await browser.newPage({
  viewport: { width: 591, height: 120 },
  deviceScaleFactor: 1,
});
await mock.goto("file:///C:/Programacion/demuxify_v2/view_target/stitch.html", {
  waitUntil: "load",
});
await mock.waitForTimeout(400);
await mock.screenshot({ path: `${OUT}/mock-591-top-08f.png` });
// crop the footer strip from the bottom of the page
const strip = await mock.evaluate(() => {
  const f = document.querySelector("footer");
  const r = f.getBoundingClientRect();
  return { top: Math.round(r.top), h: Math.round(r.height) };
});
console.log("mock footer at 591:", strip);
await mock.close();

// app at the same width
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
  await page.waitForTimeout(1200);
  return page;
}
const app = await openMix(591, 120);
const foot = await app.evaluate(() => {
  const f = document.querySelector("footer");
  const r = f.getBoundingClientRect();
  return { top: Math.round(r.top), h: Math.round(r.height) };
});
console.log("app footer at 591:", foot);
await app.screenshot({ path: `${OUT}/app-591-top-08f.png` });
await app.close();

await browser.close();
