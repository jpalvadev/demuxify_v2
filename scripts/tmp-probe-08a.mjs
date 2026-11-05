// Probe: which dev server serves the 08a Mix card (picker inside the lane)?
import { chromium } from "playwright";

const browser = await chromium.launch();

function probe() {
  const card = document.querySelector('[data-testid="click-track-rail"]');
  const picker = document.querySelector(
    '[data-testid="click-track-candidate-picker"]'
  );
  const rail = document.querySelector('[data-testid="tempo-candidates-rail"]');
  const bpm = document.querySelector('[data-testid="click-track-bpm-label"]');
  if (!card || !picker) return { ok: false, reason: "missing node" };
  const chips = [...picker.querySelectorAll("button")].map((b) =>
    b.textContent.trim()
  );
  const chipCs = picker.querySelector("button")
    ? getComputedStyle(picker.querySelector("button"))
    : null;
  return {
    ok: true,
    pickerInsideCard: card.contains(picker),
    staleRail: !!rail,
    staleBpmLabel: !!bpm,
    chips,
    chipCount: chips.length,
    cardBg: getComputedStyle(card).backgroundColor,
    pickerFont: getComputedStyle(picker).fontSize,
    chipPad: chipCs && chipCs.padding,
    chipBorder: chipCs && chipCs.borderTopColor,
    chipHeight: chipCs && chipCs.height,
    cardWidth: Math.round(card.getBoundingClientRect().width),
  };
}

for (const port of [5174, 5175]) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 2400 },
    ignoreHTTPSErrors: true,
  });
  try {
    await page.goto(`https://localhost:${port}/#debug`, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const nav = page.locator("[aria-label='Tab Band']");
    for (const btn of await nav.locator("button").all()) {
      if ((await btn.innerText()).toUpperCase().includes("MIX")) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(1200);
    console.log(`port ${port}:`, JSON.stringify(await page.evaluate(probe)));
  } catch (err) {
    console.log(`port ${port} ERROR:`, err);
  }
}
await browser.close();
