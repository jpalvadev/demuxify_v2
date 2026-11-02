import * as fs from "fs";
import * as path from "path";

// Guardrail: code identifiers and file anchors cited in the decision docs
// (docs/adr/** and CODING_STANDARDS.md) must still resolve in the repo. Docs
// that name a renamed or retired symbol mislead every agent that reads them.
// Deliberately ignored: prose inside backticks (spaces, parens, commands,
// plain lowercase words) — that drift stays a judgement call — and whole
// sections/lines that explicitly mark names as retired/deleted/history,
// because ADRs legitimately record what used to exist.

const ADR_DIR = path.resolve(process.cwd(), "docs", "adr");
const DOC_TARGETS = ["CODING_STANDARDS.md"];

const identifierToken =
  /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const codeishToken = /[A-Z0-9_$]/; // camelCase/PascalCase or symbol-ish
const historicalText =
  /(retire|deleted|removed?|history|historical|no longer)/i;
const packageSpan = /^@[\w/@-]+$/;
const pathSpan = /^[^\s`]+\/[^\s`]*$/; // path-shaped, no whitespace
const fileExtSpan = /^[^\s`]+\.(ts|tsx|mjs|md)$/i;

// Every identifier that appears in src/ or in the root config files,
// plus every src/ file path and every declared npm dependency.
const srcTokens = new Set();
const srcFiles = new Set();
const declaredDeps = new Set();

function collectSrc(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectSrc(fullPath);
      continue;
    }

    srcFiles.add(path.relative(process.cwd(), fullPath).replace(/\\/g, "/"));

    if (
      entry.name.endsWith(".ts") ||
      entry.name.endsWith(".tsx") ||
      entry.name.endsWith(".mjs")
    ) {
      const content = fs.readFileSync(fullPath, "utf8");
      for (const m of content.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
        srcTokens.add(m[0]);
      }
    }
  }
}

function collectRootConfigFiles() {
  for (const entry of fs.readdirSync(process.cwd())) {
    if (entry.endsWith(".config.ts") || entry.endsWith(".config.mjs")) {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), entry),
        "utf8"
      );
      for (const m of content.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
        srcTokens.add(m[0]);
      }
    }
  }
}

function loadDeclaredDeps() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
    );
    for (const deps of [pkg.dependencies, pkg.devDependencies]) {
      if (deps) for (const name of Object.keys(deps)) declaredDeps.add(name);
    }
  } catch {
    // no package.json: dependency anchors simply won't resolve
  }
}

console.log("🔍 Running Doc Anchor Resolution Guardrail...");
collectSrc(path.resolve(process.cwd(), "src"));
collectRootConfigFiles();
loadDeclaredDeps();

const docsToScan = [];
for (const name of DOC_TARGETS) {
  const p = path.resolve(process.cwd(), name);
  if (fs.existsSync(p)) docsToScan.push(p);
}
if (fs.existsSync(ADR_DIR)) {
  for (const entry of fs.readdirSync(ADR_DIR)) {
    if (entry.endsWith(".md")) docsToScan.push(path.join(ADR_DIR, entry));
  }
}

function fileAnchorResolves(span) {
  if (fs.existsSync(path.resolve(process.cwd(), span))) return true;
  const rel = span.replace(/^\.\//, "");
  if (srcFiles.has(rel)) return true;
  return [...srcFiles].some((file) => file.endsWith("/" + rel));
}

function identifierResolves(token) {
  const base = token.split(".")[0];
  return srcTokens.has(base);
}

let hasErrors = false;

for (const docPath of docsToScan) {
  const relative = path.relative(process.cwd(), docPath).replace(/\\/g, "/");
  const lines = fs.readFileSync(docPath, "utf8").split("\n");

  let sectionHistorical = false;

  lines.forEach((line, lineIdx) => {
    if (/^#{1,6}\s/.test(line)) {
      sectionHistorical = historicalText.test(line);
    }

    const at = (message, detail) => {
      console.error(`❌ Broken doc anchor in ${relative}:${lineIdx + 1}`);
      console.error(`   ${message} \`${detail}\``);
      console.error(
        "   👉 Re-anchor it to what exists now, or mark it as historical if the doc records a past state.\n"
      );
      hasErrors = true;
    };

    if (sectionHistorical || historicalText.test(line)) return;

    for (const m of line.matchAll(/`([^`\r\n]+)`/g)) {
      const span = m[1].trim();

      if (packageSpan.test(span)) {
        if (!declaredDeps.has(span)) {
          at("package anchor", span);
        }
        continue;
      }

      if (pathSpan.test(span) || fileExtSpan.test(span)) {
        if (!fileAnchorResolves(span)) {
          at("file anchor", span);
        }
        continue;
      }

      if (!identifierToken.test(span)) continue; // prose, commands, call shapes
      if (!codeishToken.test(span)) continue; // plain lowercase words: prose
      if (!identifierResolves(span)) {
        at("identifier", span);
      }
    }
  });
}

if (hasErrors) {
  console.error(
    "💥 Doc anchor check failed! Re-anchor or annotate the stale citations above.\n"
  );
  process.exit(1);
} else {
  console.log("✅ Doc anchor check passed cleanly.\n");
  process.exit(0);
}
