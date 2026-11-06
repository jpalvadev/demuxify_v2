import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Guardrail: the preview/PWA path serves dist/, not src/. A STALE dist/ means
// the user sees pre-fix UI while dev-server screenshots look right — the
// 2026-11-05 fidelity loop burned a full round-trip to exactly this (the user
// read ISO-tagged cards through the installed PWA while the fix was committed).
// So dist/ may never trail the src/ it claims to ship.
//
// Rules (no dist/ = nothing stale to serve = green):
//  - the commit touches src/: dist must be REBUILT at commit time — its
//    mtime within the last 15 min, i.e. `git add` → `npm run build` → commit.
//  - the commit touches no src/: dist must be at least as fresh as the newest
//    commit that touched src/ (commit timestamps; filesystem mtime of checked-
//    out sources is checkout time, so mtimes are used only for dist/ itself,
//    which npm run build writes in place).

const GRACE_MS = 15 * 60 * 1000;

console.log("🔍 Running dist/ freshness guardrail...");

const distHtml = path.resolve(process.cwd(), "dist", "index.html");
if (!fs.existsSync(distHtml)) {
  console.log("✅ No dist/ build present — nothing stale to serve.\n");
  process.exit(0);
}

const distMtime = fs.statSync(distHtml).mtimeMs;
const stagedSrc = execSync("git diff --cached --name-only", {
  encoding: "utf8",
})
  .split("\n")
  .filter((line) => line.startsWith("src/"));

let ok;
let why;
if (stagedSrc.length > 0) {
  ok = Date.now() - distMtime <= GRACE_MS;
  why =
    "this commit ships src/ changes — rebuild dist/ (`npm run build`) after " +
    "`git add` and before `git commit` so preview/PWA users get THIS build, " +
    "not the previous one";
} else {
  const lastSrcCommitS = execSync("git log -1 --format=%ct -- src", {
    encoding: "utf8",
  }).trim();
  if (!lastSrcCommitS) {
    ok = true;
    why = "";
  } else {
    ok = distMtime >= Number(lastSrcCommitS) * 1000;
    why =
      "dist/ predates the newest commit that touched src/ — rebuild it " +
      "(`npm run build`)";
  }
}

if (!ok) {
  console.error(`💥 dist/ is STALE: ${distHtml}`);
  console.error(`   👉 ${why}.\n`);
  process.exit(1);
}
console.log("✅ dist/ is fresh against src/.\n");
