// One-call anchor map for the 1,000+ line product files, so a seam lookup costs
// one command instead of a fresh grep sweep of a 1.3 k-line file. `AGENTS.md`
// "Big-file editing" says to anchor every edit with grep/sed line numbers: this
// prints those numbers, drift-proof because it reads the file it prints.
//
//   npm run outline                      → the three big files
//   npm run outline src/App.tsx ...      → any files you name
// Output: <file>:<line>  <declaration>  — declaration lines only, imports
// collapsed to a count (they are not seams).

import * as fs from "fs";
import * as path from "path";

const DEFAULT_TARGETS = [
  "src/App.tsx",
  "src/components/StemPlayer.tsx",
  "src/lib/stemPlayerEngine.ts",
];

const DECLARATION =
  /^(?:export\s+)?(?:async\s+)?(?:function|const|let|class|interface|enum)\b/;
const IMPORT_LINE = /^import\b|^} from\b/;

const targets =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_TARGETS;

for (const target of targets) {
  const fullPath = path.resolve(process.cwd(), target);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ outline: no such file ${target}`);
    continue;
  }
  const lines = fs.readFileSync(fullPath, "utf8").split("\n");
  let imports = 0;
  let seams = 0;
  console.log(`\n${target} — ${lines.length} lines`);
  lines.forEach((line, lineIdx) => {
    if (IMPORT_LINE.test(line)) {
      imports += 1;
      return;
    }
    // Top level of the file AND of its one exported component: state hooks and
    // seams live two spaces in under `export const App`.
    const indent = line.length - line.trimStart().length;
    if (indent > 2) return;
    const trimmed = line.trimStart().trimEnd();
    if (!DECLARATION.test(trimmed)) return;
    seams += 1;
    const printed =
      trimmed.length > 74 ? trimmed.slice(0, 71) + "..." : trimmed;
    console.log(`${target}:${lineIdx + 1}  ${printed}`);
  });
  console.log(`  (${imports} import lines elided, ${seams} seam anchors)`);
}
