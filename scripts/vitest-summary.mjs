// vitest-summary.mjs — one honest, machine-trustworthy read of the test suite.
//
// Usage:
//   npm run test:report                          # runs the whole suite, then summarizes
//   node scripts/vitest-summary.mjs report.json  # summarizes a saved vitest JSON report
//
// Totals come straight from the JSON reporter's own num* fields, so this
// summary can never drift from what vitest itself reported (the failure this
// replaces was a hand-rolled parser whose counts disagreed with the run).
// Failed tests are listed by full name with the first line of their failure
// message. Exit code mirrors vitest's (0 all green, 1 something failed).
//
// The working invocation is `vitest run --reporter=json` with JSON captured on
// stdout only; stderr is left to pass through so a broken run stays visible.

import { spawnSync } from "child_process";
import * as fs from "fs";
import { join, resolve } from "path";

const VITEST_ENTRY = join("node_modules", "vitest", "vitest.mjs");

function runVitest() {
  const entryAbs = resolve(process.cwd(), VITEST_ENTRY);
  const result = spawnSync(
    process.execPath,
    [entryAbs, "run", "--reporter=json"],
    {
      // stdout: pure JSON report (captured); stderr: vitest's own diagnostics
      // pass through to the terminal so a broken run is still visible.
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  if (result.error) {
    console.error("vitest could not be spawned:", result.error);
    process.exit(2);
  }
  if (!("stdout" in result)) {
    const exitCode = result.code === undefined ? "n/a" : String(result.code);
    console.error(
      "vitest produced no stdout (exit code",
      exitCode + ", signal",
      result.signal ?? "none",
      ")"
    );
    process.exit(2);
  }
  return String(result.stdout ?? "");
}

function loadReport(path) {
  try {
    return fs.readFileSync(resolve(process.cwd(), path), "utf-8");
  } catch (err) {
    console.error("vitest-summary.mjs: could not read report:", err.message);
    process.exit(2);
  }
}

function summarize(reportJson, source) {
  let parsed;
  try {
    parsed = JSON.parse(reportJson);
  } catch {
    console.error("vitest-summary.mjs: report is not valid JSON:", source);
    process.exit(2);
  }
  if (typeof parsed !== "object" || !("numTotalTests" in parsed)) {
    console.error(
      "vitest-summary.mjs: JSON lacks vitest reporter fields " +
        "(need `vitest run --reporter=json`, captured on stdout):",
      source
    );
    process.exit(2);
  }

  const files = parsed.testResults ?? [];
  const total = parsed.numTotalTests;
  const passed = parsed.numPassedTests;
  const failed = parsed.numFailedTests;
  console.log(
    `vitest: ${passed} passed / ${failed} failed ` +
      `(${total} tests across ${files.length} files)`
  );

  let listed = 0;
  for (const file of files) {
    const results = file.assertionResults ?? [];
    for (const test of results) {
      if (test.status === "passed" || test.status === "skipped") continue;
      listed++;
      const message = String(test.failureMessages?.[0] ?? "").trim();
      const firstLine = message.split("\n")[0];
      console.log(`FAIL ${file.name} :: ${test.fullName}`);
      if (firstLine) console.log(`  ${firstLine}`);
    }
    // A file can fail without per-test entries (collection/import crash).
    if (
      file.status === "failed" &&
      !results.some((t) => t.status !== "passed" && t.status !== "skipped")
    ) {
      listed++;
      console.log(`FAIL ${file.name} :: (file-level failure)`);
      const message = String(file.message ?? "").trim();
      if (message) console.log(`  ${message.split("\n")[0]}`);
    }
  }

  if (listed !== failed) {
    // Name the disagreement instead of silently trusting either count: it
    // means a suite-level crash hid individual test failures.
    console.log(
      `listed failures: ${listed} (reporter says ${failed}; ` +
        "differing counts mean a suite-level crash hid individual tests)"
    );
  } else if (failed === 0) {
    console.log("all green");
  }

  return parsed.success ? 0 : 1;
}

const reportJson =
  process.argv.length > 2 ? loadReport(process.argv[2]) : runVitest();
process.exit(summarize(reportJson, process.argv[2] ?? "vitest run stdout"));
