import * as fs from "fs";
import * as path from "path";

// Guardrail: every DOM pin a test ASSERTS PRESENCE for must still exist in the
// components. The suite pins rail controls by `data-testid`; when a control is
// renamed or dropped and the pin is left behind, the red suite is the only
// signal — and steering that says "grep the ids first" is skippable and only
// fires BEFORE an edit, so drift introduced by an edit goes unseen.
//
// The accessor shape is what makes this mechanical instead of judgemental:
//   presence (throws when missing): getByTestId / getAllByTestId /
//                                   findByTestId / findAllByTestId
//   absence (returns nothing):      queryByTestId / queryAllByTestId /
//                                   filterByTestId
// The absence half legitimately names RETIRED affordances (CODING_STANDARDS.md
// §9: a retirement turns a DOM assertion into an absence assertion), so it is
// exempt by construction — it is never a dangling pin, it is the pin that
// proves the affordance stayed gone. See `npm run check:retired-affordances`
// for the other direction of that same rule.

const SRC_DIR = path.resolve(process.cwd(), "src");
const TEST_DIRS = [
  path.resolve(SRC_DIR, "__tests__"),
  path.resolve(SRC_DIR, "test"),
];

const PRESENCE_PIN =
  /(?:get|getAll|find|findAll)ByTestId\(\s*(["'])((?:[^"'])+)\1/g;
const DECLARED_TESTID = /data-testid=(["'])((?:[^"'])+)\1/g;

function relativeTo(file) {
  return path.relative(process.cwd(), file).replace(/\\/g, "/");
}

function collectFiles(dir, stopAtTests) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (stopAtTests && (entry.name === "__tests__" || entry.name === "test"))
        continue;
      collectFiles(fullPath, stopAtTests).forEach((f) => found.push(f));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) found.push(fullPath);
  }
  return found;
}

console.log("🔍 Running Test DOM-Pin Resolution Guardrail...");

// Declared: every `data-testid` the shipped components render.
const declared = new Map(); // id -> first file that renders it
for (const file of collectFiles(SRC_DIR, true)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, lineIdx) => {
    for (const m of line.matchAll(DECLARED_TESTID)) {
      const id = m[2];
      if (!declared.has(id))
        declared.set(id, `${relativeTo(file)}:${lineIdx + 1}`);
    }
  });
}

let hasErrors = false;
let pinned = 0;
let scannedTestFiles = 0;

for (const dir of TEST_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of collectFiles(dir, false)) {
    scannedTestFiles += 1;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("/*")) return;
      for (const m of line.matchAll(PRESENCE_PIN)) {
        const id = m[2];
        pinned += 1;
        if (declared.has(id)) continue;
        console.error(
          `❌ Orphaned DOM pin in ${relativeTo(file)}:${lineIdx + 1}`
        );
        console.error(`   "${trimmed}"`);
        console.error(
          `   👉 No component renders data-testid="${id}" anymore. Restore the ` +
            "pin's control, or — if the affordance was deliberately retired — " +
            "turn this into an ABSENCE assertion (queryByTestId(...)) expected " +
            "null, per CODING_STANDARDS.md §9. Never delete the test: that " +
            "blinds the suite to the affordance coming back.\n"
        );
        hasErrors = true;
      }
    });
  }
}

if (hasErrors) {
  console.error(
    "💥 Test DOM-pin check failed! The suite pins ids the components no longer " +
      "render.\n"
  );
  process.exit(1);
} else {
  console.log(
    `✅ DOM pins resolve: ${pinned} presence pins across ` +
      `${scannedTestFiles} test files against ${declared.size} rendered ids.\n`
  );
  process.exit(0);
}
