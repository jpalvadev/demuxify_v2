// Throwaway: measure the mock's mobile stem card (stitch.html at 390px) vs
// the app's live card — card/header/wave/slider rects, insets and gaps.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function measure(label, url, hash) {
  await page.goto(url + (hash || ""), { waitUntil: "load" });
  await page.waitForTimeout(hash ? 2400 : 900);
  if (hash) {
    for (const btn of await page
      .locator("[aria-label='Tab Band'] button")
      .all()) {
      if ((await btn.innerText()).toUpperCase().includes("MIX")) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(1200);
  }
  const data = await page.evaluate(() => {
    const rects = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: +r.x.toFixed(1),
        y: +r.y.toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
      };
    };
    const out = {};
    // Mock: the card containing "Vocals" in a mono header; App: role group.
    const card =
      document.querySelector('[role="group"][aria-label="Vocals Stem"]') ||
      [...document.querySelectorAll("div")].find(
        (d) =>
          d.className.includes("rounded") &&
          d.textContent.includes("Vocals") &&
          d.textContent.includes("100%") &&
          d.querySelectorAll("div").length < 40 &&
          d.getBoundingClientRect().height > 100
      );
    if (!card) return { err: "no card" };
    out.card = rects(card);
    const kids = [...card.children].map(rects);
    out.kids = kids;
    // find the slider-ish leaf (input or thin div) and knob (rounded coral)
    for (const el of card.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const isWave =
        r.height > 40 &&
        r.width > 200 &&
        (el.tagName === "CANVAS" ||
          el.querySelector("canvas") ||
          cs.backgroundColor !== "rgba(0, 0, 0, 0)");
      if (el.tagName === "INPUT" && el.type === "range") out.slider = rects(el);
      if (out.slider === undefined && r.h <= 6 && r.w > 150 && r.h >= 2)
        out.slider = rects(el);
      if (
        parseInt(cs.borderRadius) >= 99 ||
        cs.borderRadius === "9999px" ||
        (r.width <= 16 &&
          r.width >= 8 &&
          Math.abs(r.width - r.height) < 2 &&
          cs.backgroundColor.includes("248, 81"))
      )
        out.knob = { ...rects(el), r: cs.backgroundColor };
    }
    return out;
  });
  console.log(label + ":", JSON.stringify(data, null, 1));
}

await measure(
  "MOCK",
  "file:///C:/Programacion/demuxify_v2/view_target/stitch.html"
);
await measure("APP", process.argv[2] || "https://localhost:5174/", "#debug");
await browser.close();
