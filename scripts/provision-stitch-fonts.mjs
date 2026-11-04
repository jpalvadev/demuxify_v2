import * as fs from "fs";
import * as https from "https";

// Stitch Skin font provisioning (spec .scratch/stitch-skin ticket 01): Inter and
// JetBrains Mono self-hosted as woff2 subsets delivered from the app's own font
// directory (public/fonts/stitch) — same delivery mechanism as the bundled
// Wayback faces, so the offline PWA never issues a Google Fonts CDN request at
// runtime. This one-off fetches the `latin` subset file each family publishes on
// the fonts.gstatic.com stylesheet (the only place the files exist as ready-made
// woff2 subsets) and writes them LOCAL to the repo. The mockup's CDN <link>s are
// the design source, never code to copy.
//
// Run: node scripts/provision-stitch-fonts.mjs

const DEST_DIR = "public/fonts/stitch";

const FAMILIES = [
  {
    css: "https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=block",
    file: "inter-latin.woff2",
  },
  {
    css:
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..700" +
      "&display=block",
    file: "jetbrains-mono-latin.woff2",
  },
];

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { ...headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        return fetch(res.headers.location, headers).then(resolve);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`${url} -> ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("close", () => reject(new Error("connection closed")));
  });
}

function fetchText(url, headers = {}) {
  return fetch(url, headers).then((buf) => buf.toString("utf8"));
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/605.05 (KHTML," +
  " CSS like Gecko) Chrome/120.0.0.0 Safari/605.05";

(async () => {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  for (const { css, file } of FAMILIES) {
    const sheet = await fetchText(css, { "User-Agent": UA });
    // The stylesheet ships one @font-face block per unicode subset, each
    // preceded by a `/* subset */` comment. Keep the latin block's url only.
    const latinBlock = sheet.match(/\/\*\s*latin\s*\*\/[^}]*}/m);
    if (!latinBlock) {
      throw new Error(`no latin block for ${css}`);
    }
    const urlMatch = latinBlock[0].match(/url\((https:[^)]+\.woff2)\)/);
    if (!urlMatch) {
      throw new Error(`no woff2 url in latin block for ${css}`);
    }
    const bytes = await fetch(urlMatch[1], { "User-Agent": UA });
    fs.writeFileSync(`${DEST_DIR}/${file}`, bytes);
    console.log(`${file}: ${bytes.length} bytes from ${urlMatch[1]}`);
  }
  console.log("done");
})();
