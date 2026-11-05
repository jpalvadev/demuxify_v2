// Ticket 09 probe: what does the app show after file injection?
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const URL = "https://localhost:5173/";
const TMP = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 250));
});
await page.goto(URL, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(3000);
const inp = await page.$('input[aria-label="Select Source Mix file"]');
console.log("input found:", !!inp);
await inp.setInputFiles({
  name: "probe-tone.wav",
  mimeType: "audio/wav",
  buffer: (() => {
    const sampleRate = 44100,
      dur = 6,
      n = sampleRate * dur,
      buf = new ArrayBuffer(44 + n * 4),
      v = new DataView(buf);
    const wstr = (o, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    wstr(0, "RIFF");
    v.setUint32(4, 36 + n * 4, true);
    wstr(8, "WAVEfmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 2, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 4, true);
    v.setUint16(32, 4, true);
    v.setUint16(34, 16, true);
    wstr(36, "data");
    v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const l = Math.sin(2 * Math.PI * 440 * t) * 0.9 * 32767,
        r = Math.sin(2 * Math.PI * 330 * t) * 0.7 * 32767;
      v.setInt16(44 + i * 4, l, true);
      v.setInt16(44 + i * 4 + 2, r, true);
    }
    return Buffer.from(new Uint8Array(buf));
  })(),
});
await page.waitForTimeout(6000);
const text = await page.evaluate(() =>
  document.body.innerText.replace(/\n{2,}/g, "\n").slice(0, 1200)
);
console.log("== body text ==\n" + text);
writeFileSync(
  `${TMP}/app-09-look.png`,
  await page.screenshot({ fullPage: false })
);
await browser.close();
console.log("== done ==");
