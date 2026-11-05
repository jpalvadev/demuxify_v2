// One-off fidelity probe: computed colors, running app vs the mockup page.
// Prints label | app value | mock value | MATCH/DIFF per sampled token.
import { chromium } from "playwright";

const APP_URL = "https://localhost:5174/#debug";
const MOCK_URL = "file:///C:/Programacion/demuxify_v2/view_target/stitch.html";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});

// Shared sampler body, evaluated on either page. `roles` maps a label to a
// DOM resolver returning an element; each label samples bg/border/text.
const SAMPLE_BODY = ({ roles }) => {
  const resolve = {
    bandNav: () =>
      document.querySelector('[aria-label="Tab Band"]') ||
      document.querySelector("header"),
    chipContainer: () =>
      document.querySelector('[data-testid="tab-band-chips"]') ||
      document.querySelector('nav[aria-label="Mode Navigation"]'),
    chipInactive: () => {
      const nav =
        document.querySelector('[aria-label="Tab Band"]') ||
        document.querySelector('nav[aria-label="Mode Navigation"]');
      if (!nav) return null;
      for (const b of nav.querySelectorAll("button"))
        if (
          !b.getAttribute("class")?.includes("bg-primary") &&
          !b.getAttribute("class")?.includes("bg-brand-accent")
        )
          return b;
      return null;
    },
    chipActive: () => {
      const nav =
        document.querySelector('[aria-label="Tab Band"]') ||
        document.querySelector('nav[aria-label="Mode Navigation"]');
      if (!nav) return null;
      for (const b of nav.querySelectorAll("button"))
        if (b.getAttribute("class")?.match(/bg-primary|bg-brand-accent/))
          return b;
      return null;
    },
    workspace: () =>
      document.querySelector('[aria-label="Mix Tab"]') ||
      document.querySelector("main"),
    bandHead: () => {
      const sec = document.querySelector(
        'section[aria-label^="Master Waveform"]'
      );
      if (sec) return sec;
      const d = document.querySelector(
        '[class*="rounded-t-lg"][class*="bg-st-panel"]'
      );
      if (d) return d;
      return document.querySelector("#master-waveform-box");
    },
    bandFoot: () =>
      document.querySelector('[data-testid="tempo-candidates-rail"]') ||
      (() => {
        for (const s of document.querySelectorAll("section"))
          if (s.getAttribute("aria-label")?.startsWith("Master Waveform")) {
            for (const d of s.querySelectorAll(":scope > div"))
              if (d.querySelector("[aria-pressed]")) return d;
          }
        return null;
      })(),
    leaderChip: () => {
      const rail = document.querySelector(
        '[data-testid="tempo-candidates-rail"]'
      );
      if (rail) return rail.querySelector('[class*="coral"]');
      for (const s of document.querySelectorAll("section"))
        if (s.getAttribute("aria-label")?.startsWith("Master Waveform"))
          for (const d of s.querySelectorAll("div"))
            if (d.getAttribute("class")?.includes("accentMuted")) return d;
      return null;
    },
    altChip: () => {
      const rail = document.querySelector(
        '[data-testid="tempo-candidates-rail"]'
      );
      if (rail) {
        const buttons = rail.querySelectorAll("button");
        return buttons.length > 1 ? buttons[1] : null;
      }
      for (const s of document.querySelectorAll("section"))
        if (s.getAttribute("aria-label")?.startsWith("Master Waveform"))
          for (const d of s.querySelectorAll("div"))
            if (
              d.getAttribute("class")?.includes("bg-brand-surface") &&
              d.getAttribute("class")?.includes("cursor-pointer")
            )
              return d;
      return null;
    },
    stemCard: () =>
      document.querySelector("article") ||
      (() => {
        const rows = document.querySelectorAll(
          '[aria-label$="stem" i][role="group"]'
        );
        return rows.length ? rows[0] : null;
      })(),
    badgeCol: () => {
      const art = document.querySelector("article");
      if (art)
        for (const d of art.children)
          if (d.getAttribute("class")?.includes("w-32")) return d;
      const rows = document.querySelectorAll(
        '[aria-label$="stem" i][role="group"]'
      );
      return rows.length ? rows[0].querySelector('[class*="w-32"]') : null;
    },
    waveField: () => {
      const want = "rgb(13, 12, 19)";
      for (const d of document.querySelectorAll("div")) {
        const s = getComputedStyle(d);
        if (s.backgroundColor === want) return d;
      }
      const c = document.querySelector("#waveform-vocals");
      if (c) return c.parentElement;
      const c2 = document.querySelector('[data-testid="stem-vocals-waveform"]');
      return c2 ? c2.parentElement : null;
    },
    titleText: () => findText("MASTER WAVEFORM") || findText("Master Waveform"),
    overviewText: () => findText("Overview"),
    resetText: () => findText("Reset taps"),
  };
  function findText(start) {
    const walker = document.createTreeWalker(document.body, 4);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.trim().startsWith(start)) {
        let el = n.parentElement;
        while (
          el &&
          el.textContent.trim() !== n.nodeValue.trim() &&
          el.parentElement &&
          el.parentElement.textContent.trim() === el.textContent.trim()
        )
          el = el.parentElement;
        return el;
      }
    }
    return null;
  }
  const out = {};
  for (const [label, fn] of Object.entries(resolve)) {
    let el = null;
    try {
      el = fn();
    } catch {
      el = null;
    }
    if (!el) {
      out[label] = null;
      continue;
    }
    const s = getComputedStyle(el);
    const bw = parseFloat(s.borderWidth) || 0;
    out[label] = {
      bg: s.backgroundColor,
      border: bw > 0 ? s.borderColor : "none",
      text: s.color,
    };
  }
  return out;
};

await page.goto(APP_URL, { waitUntil: "load" });
await page.waitForTimeout(2200);
{
  const nav = page.locator("[aria-label='Tab Band']");
  const buttons = await nav.locator("button").all();
  for (const btn of buttons) {
    if ((await btn.innerText()).trim().toUpperCase() === "MIX") {
      await btn.click();
      break;
    }
  }
}
await page.waitForTimeout(1200);
const appColors = await page.evaluate(SAMPLE_BODY, { roles: true });

await page.goto(MOCK_URL, { waitUntil: "load" });
await page.waitForTimeout(1500);
const mockColors = await page.evaluate(SAMPLE_BODY, { roles: true });

const fmt = (v) => (v == null ? "—" : JSON.stringify(v));
const rows = [];
for (const label of Object.keys(mockColors)) {
  const a = appColors[label];
  const m = mockColors[label];
  if (!m) continue;
  const mKeys = Object.keys(m);
  for (const k of mKeys) {
    if (String(a?.[k] ?? "—") !== String(m[k]))
      rows.push(`${label}.${k}: app ${a?.[k] ?? "—"} ≠ mock ${m[k]}`);
  }
}
console.log(`DIFFS (${rows.length}):`);
rows.forEach((r) => console.log(r));
console.log("sampled:", Object.keys(mockColors).join(" "));
await browser.close();
