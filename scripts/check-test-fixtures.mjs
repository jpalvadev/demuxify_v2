import * as fs from "fs";
import * as path from "path";

// Guardrail: expected-value fixtures in tests must be TYPED constants, not
// object literals passed straight to toEqual/toStrictEqual/toMatch. An inline
// literal is an untyped argument: `typecheck` never sees drift in it, and
// vitest dumps the whole shape on failure. Fix shape:
//   const expectedLane: ClickTrackMixerState = { ... };
//   expect(engine.getClickTrackState()).toEqual(expectedLane);
// Small single-line literals stay allowed (they are readable at the call site);
// multi-line object literals (fixture clumps) are flagged.

const TEST_DIR = path.resolve(process.cwd(), "src", "__tests__");

const CALL_PATTERN = /\.(toEqual|toStrictEqual|toMatch)\(\s*\{\s*$/;

let hasErrors = false;

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDir(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;

    const lines = fs.readFileSync(fullPath, "utf8").split("\n");

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*")
      )
        return;

      if (CALL_PATTERN.test(line)) {
        const relative = path
          .relative(process.cwd(), fullPath)
          .replace(/\\/g, "/");
        console.error(`❌ Untyped test fixture in ${relative}:${lineIdx + 1}`);
        console.error(`   "${trimmed}"`);
        console.error(
          "   👉 Hoist this expectation into a typed const fixture " +
            "(const expected: DomainType = { ... }) and pass the variable, " +
            "so `typecheck` sees drift. See CODING_STANDARDS.md §8.\n"
        );
        hasErrors = true;
      }
    });
  }
}

console.log("🔍 Running Typed Test-Fixture Guardrail...");
scanDir(TEST_DIR);

if (hasErrors) {
  console.error(
    "💥 Test fixture check failed! Extract the multi-line literals above into typed const fixtures.\n"
  );
  process.exit(1);
} else {
  console.log("✅ Test fixture check passed cleanly.\n");
  process.exit(0);
}
