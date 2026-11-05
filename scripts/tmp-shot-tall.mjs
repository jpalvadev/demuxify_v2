// one-off: tall viewport + MIX click so the whole Mix stage renders at once
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1650 },
  ignoreHTTPSErrors: true,
});
await page.goto("https://localhost:5174/#debug", { waitUntil: "load" });
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
await page.screenshot({
  path: "C:/Users/Lorenzo06/AppData/Local/Temp/opencode/app-mix-tall.png",
  fullPage: true,
});
console.log("app-mix-tall done");
await browser.close();
