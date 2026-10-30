import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.resolve(process.cwd(), "src");

// Forbidden identifiers / terms in application code
const FORBIDDEN_PATTERNS = [
  {
    pattern: /\bStemTrack\b/g,
    reason:
      "GLOSSARY.md rule: Avoid 'Track' for isolated stems. Use 'StemStrip' or 'Stem'.",
  },
  {
    pattern: /\bsongTitle\b/g,
    reason: "GLOSSARY.md rule: Avoid 'song'. Use 'sourceMixTitle'.",
  },
];

const IGNORED_FILES = [
  "StemTrack.tsx", // Backwards compatibility alias re-export file
];

// Patterns forbidden outside of modelConfig.ts
const MODEL_CONFIG_RESTRICTED_PATTERNS = [
  {
    pattern: /demuxify-(roformer|htdemucs|openunmix|mdxnet)-cache/g,
    reason:
      "ADR 0005 rule: Cache partition keys must only be defined in src/lib/modelConfig.ts. Use resolveModelProfile() or ModelProfile.cacheName.",
  },
  {
    pattern:
      /(bs_roformer_4stem_webgpu|htdemucs_4stem_mobile|open_unmix_4stem_mobile|mdx_net_4stem_mobile)\.onnx/g,
    reason:
      "ADR 0005 rule: Model asset filenames must only be defined in src/lib/modelConfig.ts. Use resolveModelProfile() or ModelProfile.modelUrl.",
  },
];

let hasErrors = false;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "test") {
        scanDir(fullPath);
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      if (IGNORED_FILES.includes(entry.name)) continue;

      const content = fs.readFileSync(fullPath, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, lineIdx) => {
        // Skip comment lines
        const trimmed = line.trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("*")
        )
          return;

        for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            console.error(
              `❌ Glossary violation in ${path.relative(process.cwd(), fullPath)}:${lineIdx + 1}`
            );
            console.error(`   "${line.trim()}"`);
            console.error(`   👉 ${reason}\n`);
            hasErrors = true;
          }
        }

        if (entry.name !== "modelConfig.ts") {
          for (const { pattern, reason } of MODEL_CONFIG_RESTRICTED_PATTERNS) {
            if (pattern.test(line)) {
              console.error(
                `❌ Centralized Model Identity violation in ${path.relative(process.cwd(), fullPath)}:${lineIdx + 1}`
              );
              console.error(`   "${line.trim()}"`);
              console.error(`   👉 ${reason}\n`);
              hasErrors = true;
            }
          }
        }
      });
    }
  }
}

console.log("🔍 Running Glossary Terminology Guardrail...");
scanDir(SRC_DIR);

if (hasErrors) {
  console.error(
    "💥 Glossary terminology check failed! Fix the violations above.\n"
  );
  process.exit(1);
} else {
  console.log("✅ Glossary terminology check passed cleanly.\n");
  process.exit(0);
}
