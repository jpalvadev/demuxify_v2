// Geometry + paint probe for the Mix stage (desktop): card/chip boxes and the
// computed container styles, read from the live DOM.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
await page.goto("https://localhost:5174/#debug", { waitUntil: "load" });
await page.waitForTimeout(2200);
const nav = page.locator("[aria-label='Tab Band']");
for (const btn of await nav.locator("button").all()) {
  if ((await btn.innerText()).toUpperCase().includes("MIX")) {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(1400);

function geom() {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return `x${Math.round(r.x)} w${Math.round(r.width)} h${Math.round(r.height)}`;
  };
  const card = document.querySelector('[data-testid="click-track-rail"]');
  const picker = document.querySelector(
    '[data-testid="click-track-candidate-picker"]'
  );
  const cardCs = getComputedStyle(card);
  const pickerCs = picker ? getComputedStyle(picker) : null;
  const chips = picker ? [...picker.querySelectorAll("button")] : [];
  const first = chips[0];
  const chipCs = first ? getComputedStyle(first) : null;
  return {
    card: box(card),
    cardPaint: `${cardCs.borderTopWidth} ${cardCs.borderTopColor} bg ${cardCs.backgroundColor} radius ${cardCs.borderRadius}`,
    picker: picker ? box(picker) : "none",
    pickerPaint: pickerCs
      ? `${pickerCs.borderTopWidth} ${pickerCs.borderTopColor} bg ${pickerCs.backgroundColor} radius ${pickerCs.borderRadius}`
      : "none",
    chips: chips.map((b) => `${box(b)} "${b.textContent.trim()}"`),
    chipPaint: chipCs
      ? `${chipCs.padding} ${chipCs.borderTopWidth} ${chipCs.borderTopColor} bg ${chipCs.backgroundColor}`
      : "none",
    kids: [...card.children].map(
      (k) => `${k.getAttribute("data-testid") ?? k.tagName} ${box(k)}`
    ),
    ranges: [...card.querySelectorAll('input[type="range"]')].map((i) =>
      box(i)
    ),
  };
}
console.log(JSON.stringify(await page.evaluate(geom), null, 1));
await browser.close();
