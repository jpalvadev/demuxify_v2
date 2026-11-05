// 08b geometry probe: island vs card inner width and per-chip widths.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
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

const data = await page.evaluate(() => {
  const card = document.querySelector("[data-testid='click-track-rail']");
  const island = document.querySelector(
    "[data-testid='click-track-candidate-picker']"
  );
  const cardBox = card.getBoundingClientRect();
  const cs = getComputedStyle(card);
  const inner =
    cardBox.width -
    parseFloat(cs.paddingLeft) -
    parseFloat(cs.paddingRight) -
    parseFloat(cs.borderLeftWidth) -
    parseFloat(cs.borderRightWidth);
  const islandBox = island.getBoundingClientRect();
  const chips = [...island.querySelectorAll(":scope > button")].map((b) => {
    const r = b.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      left: Math.round(r.left - islandBox.left),
      right: Math.round(r.right - islandBox.left),
      text: b.textContent.trim(),
    };
  });
  return {
    cardInner: Math.round(inner),
    islandW: Math.round(islandBox.width),
    chips,
  };
});
console.log(JSON.stringify(data));
await browser.close();
