# 04: Full Verification Sweep, Doc Anchors & Dist Freshness

**What to build:** Execution and verification of the complete repository test suite, doc-anchor linters, glossary conformance, typecheckers, and production distribution builds, guaranteeing that the codebase passes all pre-commit hooks and regression gates cleanly.

**Blocked by:** 03: App Shell Integration & InferenceClient Retirement

**Status:** ready-for-agent

- [ ] `npm run check:glossary` passes cleanly with zero undefined terms or terminology violations.
- [ ] `npm run check:doc-anchors` passes cleanly, verifying that all code identifiers and citations in ADR-0019 and CODING_STANDARDS.md resolve.
- [ ] `npm run check:testids` passes cleanly with zero unpinned or drifting testid attributes.
- [ ] `npm run check:retired-affordances` passes cleanly, confirming no resurrected deprecated properties or shims.
- [ ] `node node_modules/typescript/bin/tsc --noEmit` compiles cleanly with zero TypeScript diagnostic errors.
- [ ] `npm run test:report` executes all unit and integration test suites green.
- [ ] `npm run build` generates a fresh, clean `dist/` bundle satisfying `check:dist-fresh`.
- [ ] All pre-commit chain checks (`.husky/pre-commit`) pass green.
