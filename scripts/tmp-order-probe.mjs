// probe: which order-* rules exist in the dev-served stylesheet
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto("https://localhost:5175/#debug", { waitUntil: "load" });
const rules = await page.evaluate(() => {
  const out = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const r of sheet.cssRules) {
        const t = r.cssText;
        if (/[\s{;]order\s*:/.test(t)) out.push(t);
      }
    } catch (e) {
      /* cross-origin sheets skip */
    }
  }
  return out;
});
console.log(JSON.stringify(rules, null, 0).slice(0, 2500));
await browser.close();
