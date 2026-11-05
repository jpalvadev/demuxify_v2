// 08e mobile footer probe: running app footer at 390 (overflow measurements)
// plus the mock stitch.html footer at 390 for truth.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "C:/Users/Lorenzo06/AppData/Local/Temp/opencode";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function openMix(w, h) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 2,
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

const mob = await openMix(390, 844);
await mob.screenshot({
  path: `${OUT}/app-mix-mobile-08e.png`,
  fullPage: false,
});
const foot = mob.locator("footer").first();
await foot.screenshot({ path: `${OUT}/app-footer-mobile-08e.png` });
const geo = await mob.evaluate(() => {
  const f = document.querySelector("footer");
  const r = f.getBoundingClientRect();
  const kids = [...f.children].map((c) => ({
    x: Math.round(c.getBoundingClientRect().left),
    w: Math.round(c.getBoundingClientRect().width),
    y: Math.round(c.getBoundingClientRect().top),
  }));
  const f2 = document.querySelector("[data-testid='footer-play-pause']");
  // actual restacked widths of the clusters
  const kidsArr = [...f.children];
  const natur = kidsArr.map((c) => Math.round(c.getBoundingClientRect().width));
  const inner = [...kidsArr[0].children, ...kidsArr[2].children].map((c) =>
    Math.round(c.getBoundingClientRect().width)
  );
  const barCs = getComputedStyle(f);
  const midCs = getComputedStyle(kidsArr[1]);
  const leftCs = getComputedStyle(kidsArr[0]);
  const probe = {
    barWrap: barCs.flexWrap,
    barGapY: barCs.rowGap,
    midOrder: midCs.order,
    midMx: midCs.marginLeft + "/" + midCs.marginRight,
    leftDir: leftCs.flexDirection,
    leftW72: leftCs.width,
  };
  const middleKids = [...kidsArr[1].children].map((c) => {
    const b = c.getBoundingClientRect();
    return { x: Math.round(b.left), w: Math.round(b.width) };
  });
  return {
    vw: window.innerWidth,
    footer: {
      x: Math.round(r.left),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
    kids,
    probe,
    natur,
    inner,
    middleKids,
    discY: f2 ? Math.round(f2.getBoundingClientRect().top) : null,
    docScrollW: document.documentElement.scrollWidth,
  };
});
console.log("APP:", geo);
await mob.close();

// Mock truth at the same viewport.
const mock = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await mock.goto("file:///C:/Programacion/demuxify_v2/view_target/stitch.html", {
  waitUntil: "load",
});
await mock.waitForTimeout(600);
const mf = mock.locator("footer").first();
await mf.screenshot({ path: `${OUT}/mock-footer-mobile-08e.png` });
const mgeo = await mock.evaluate(() => {
  const f = document.querySelector("footer");
  const r = f.getBoundingClientRect();
  const kids = [...f.children].map((c) => ({
    x: Math.round(c.getBoundingClientRect().left),
    w: Math.round(c.getBoundingClientRect().width),
    y: Math.round(c.getBoundingClientRect().top),
  }));
  return {
    vw: window.innerWidth,
    footer: {
      x: Math.round(r.left),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
    kids,
    docScrollW: document.documentElement.scrollWidth,
  };
});
console.log("MOCK:", mgeo);

// desktop rail must stay byte-identical to 08d
const desk = await openMix(1440, 900);
const dfoot = desk.locator("footer").first();
await dfoot.screenshot({ path: `${OUT}/app-footer-desktop-08e.png` });
const dgeo = await desk.evaluate(() => {
  const f = document.querySelector("footer");
  const r = f.getBoundingClientRect();
  const kidsArr = [...f.children];
  const midCs = getComputedStyle(kidsArr[1]);
  return {
    vw: window.innerWidth,
    footer: {
      x: Math.round(r.left),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
    kids: [...f.children].map((c) => ({
      x: Math.round(c.getBoundingClientRect().left),
      w: Math.round(c.getBoundingClientRect().width),
    })),
    wrap: getComputedStyle(f).flexWrap,
    order0: midCs.order,
    mx: midCs.marginLeft,
    dir: getComputedStyle(kidsArr[0]).flexDirection,
    docScrollW: document.documentElement.scrollWidth,
  };
});
console.log("DESKTOP:", dgeo);
await desk.close();

await browser.close();
