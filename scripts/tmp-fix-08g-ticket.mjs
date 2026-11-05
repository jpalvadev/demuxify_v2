// split the mangled line 37 back into the 08f bullet followed by the 08g bullet
import fs from "fs";
const P = ".scratch/stitch-skin/issues/07-verification-and-adr-record.md";
const t = fs.readFileSync(P, "utf8");
const JUNCTION = "no OpenDesign call this effort). — clock chip";
const i = t.indexOf(JUNCTION);
if (i === -1) {
  console.log("junction not found — abort");
  process.exit(1);
}
const gEnd = i + "no OpenDesign call this effort).".length;
const gPart = t.slice(t.lastIndexOf("- 2026-11-04 fidelity 08g", i), gEnd);
const fHead =
  "- 2026-11-04 fidelity 08f (user's new crop: a SINGLE compact rail at ~480 phones";
const fTailStart = i + "no OpenDesign call this effort).".length;
const fTail = t.slice(fTailStart);
const before = t.slice(0, t.lastIndexOf("- 2026-11-04 fidelity 08g", i));
fs.writeFileSync(
  P,
  before + fHead + fTail.trimEnd() + "\n" + gPart.trimEnd() + "\n"
);
console.log("fixed");
