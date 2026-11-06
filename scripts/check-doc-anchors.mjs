import * as fs from "fs";
import * as path from "path";

// Guardrail: code identifiers, file anchors and the derived numbers an ADR
// records (`NAME = 0.08 s`) cited in the decision docs (docs/adr/** and
// CODING_STANDARDS.md) must still resolve in the repo — a doc that keeps a
// renamed symbol, a deleted file, or a number the shipped code no longer runs
// with misleads every agent that reads it.
// Deliberately ignored: prose inside backticks (spaces, parens, commands,
// plain lowercase words) — that drift stays a judgement call — and whole
// sections/lines that explicitly mark names as retired/deleted/history,
// because ADRs legitimately record what used to exist.
//
// There is also a reverse pass: a docs/<path> citation inside SHIPPED CODE
// (src/ and scripts/) must point at a doc that exists. Comments and gate
// ban-reasons are what agents follow, and a citation gesturing at a doc
// without naming one misleads every run after it; wrapped comment lines
// are rejoined before matching so a path split across `//` lines resolves
// whole.

const ADR_DIR = path.resolve(process.cwd(), "docs", "adr");
const DOC_TARGETS = ["CODING_STANDARDS.md"];

const identifierToken =
  /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const codeishToken = /[A-Z0-9_$]/; // camelCase/PascalCase or symbol-ish
const historicalText =
  /(retire|deleted|removed?|history|historical|no longer|renam(ed|ing)?|prior\b|previously|superseded)/i;
const packageSpan = /^@[\w/@-]+$/;
const pathSpan = /^[^\s`]+\/[^\s`]*$/; // path-shaped, no whitespace
const fileExtSpan = /^[^\s`]+\.(ts|tsx|mjs|md)$/i;

// Every identifier that appears in src/ or in the root config files,
// plus every src/ file path and every declared npm dependency, plus every
// NUMERIC constant src/ declares: an ADR that records a derived number
// (`NAME = 0.08 s`) is checked against the value the shipped code runs with.
const srcTokens = new Set();
const srcFiles = new Set();
const declaredDeps = new Set();
const srcConstants = new Map(); // NAME -> Set of numeric values it is set to

function collectConstantAnchors(content) {
  for (const m of content.matchAll(
    /(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)/g
  )) {
    if (!srcConstants.has(m[1])) srcConstants.set(m[1], new Set());
    srcConstants.get(m[1]).add(Number(m[2]));
  }
}

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
      collectConstantAnchors(content);
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

      // A derived number recorded in prose: `NAME = 0.08 s` must equal the
      // constant the shipped code runs with, or the ADR's derivation silently
      // drifted from what executes. A number that names no such constant in
      // src/ is as broken an anchor as a renamed symbol is.
      const constant =
        /^([A-Z][A-Z0-9_]{2,})\s*=\s*(-?\d+(?:\.\d+)?)(?:\s*[A-Za-zµ°%/]+\s*)?$/.exec(
          span
        );
      if (constant) {
        const [, name, recorded] = constant;
        const values = srcConstants.get(name);
        if (values && values.has(Number(recorded))) continue;
        if (values) {
          at(
            `derived-constant drift for \`${name}\``,
            `${span} recorded, src/ runs ${[...values].join(" | ")}`
          );
        } else {
          at("unresolvable constant anchor", span);
        }
        continue;
      }

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

// Reverse pass: docs/<path> citations inside shipped code (src/ + scripts/)
// must resolve to an existing file. Comment paragraphs wrapped across lines
// are rejoined with a sentinel, and each wrap point is also a candidate CUT:
// a path split mid-name by the wrap still resolves whole, while a completed
// citation followed by prose on the next line is not glued onto that prose.
// A dangling ellipsis (unwrapped, or a wrapped one whose cut lands on a bare
// directory) names a doc without naming it — red.
const commentWrap = /\r?\n\s*(?:\/\/+\s?|\*+\s?)/g;
const docsCitation = /docs\/(?:[A-Za-z0-9_./-]|\u0000(?=[A-Za-z0-9_./-]))+/g;

function citationCandidates(span) {
  const candidates = [];
  let joinedHead = "";
  let segment = "";
  for (const ch of span) {
    if (ch === "\u0000") {
      candidates.push(joinedHead + segment);
      joinedHead += segment;
      segment = "";
    } else {
      segment += ch;
    }
  }
  candidates.push(joinedHead + segment);
  return candidates;
}

function citationResolves(candidate, isMaximal) {
  const span = candidate.replace(/([^\.])\.$/, "$1"); // strip a sentence dot
  // a wrap-cut must land on a real file, never a bare directory
  if (!isMaximal && !/\.[a-z]{2,4}$/.test(span)) return false;
  return fs.existsSync(path.resolve(process.cwd(), span));
}

function checkDocsCitations(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkDocsCitations(fullPath);
      continue;
    }
    if (!/\.(ts|tsx|mjs)$/.test(entry.name)) continue;
    const joined = fs
      .readFileSync(fullPath, "utf8")
      .replace(commentWrap, "\u0000");
    const relative = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
    for (const m of joined.matchAll(docsCitation)) {
      const candidates = citationCandidates(m[0]);
      const last = candidates.length - 1;
      let resolved = false;
      for (let k = 0; k <= last; k += 1) {
        if (citationResolves(candidates[k], k === last)) {
          resolved = true;
          break;
        }
      }
      if (resolved) continue;
      console.error(`❌ Dangling docs citation in ${relative}`);
      console.error(
        `   \`${candidates[last].replace(/([^\.])\.$/, "$1")}\` — no doc file resolves at this path`
      );
      console.error(
        "   👉 Name a doc that exists, or cite the tracker spec + ticket — never a bare ellipsis.\n"
      );
      hasErrors = true;
    }
  }
}

checkDocsCitations(path.resolve(process.cwd(), "src"));
checkDocsCitations(path.resolve(process.cwd(), "scripts"));

if (hasErrors) {
  console.error(
    "💥 Doc anchor check failed! Re-anchor or annotate the stale citations above.\n"
  );
  process.exit(1);
} else {
  console.log("✅ Doc anchor check passed cleanly.\n");
  process.exit(0);
}
