// Dump the seed literal from scripts/shot-mix.mjs to seed_body.js for --check.
const fs = require("node:fs");
const src = fs.readFileSync("scripts/shot-mix.mjs", "utf8");
const key = "const seed = " + String.fromCharCode(96);
const start = src.indexOf(key);
console.log("start:", start);
const open = start + key.length;
const end = src.indexOf(String.fromCharCode(96), open);
console.log("open:", open, "end:", end, "len:", end - open);
const seed = src.slice(open, Math.max(end, open));
fs.writeFileSync(
  "C:/Users/Lorenzo06/AppData/Local/Temp/opencode/seed_body.js",
  seed
);
console.log("first120:", JSON.stringify(seed.slice(0, 120)));
console.log("last120:", JSON.stringify(seed.slice(-120)));
