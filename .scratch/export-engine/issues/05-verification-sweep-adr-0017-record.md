# 05: Verification Sweep, ADR-0017 Authoring & Pre-Commit Gates

**What to build:** Record the architectural decision by authoring `docs/adr/0017-the-export-engine-speaks-commands-and-renders-one-export-payload.md` in standard house format. Run the complete pre-commit validation suite, verify doc-anchor resolution across all ADRs, ensure zero visual regression against `view_target/stitch.html`, and update the feature status to resolved in `spec.md`.

**Blocked by:** 04: The Bridge Purge — Direct Shell Facts & Snapshot Feed.

**Status:** ready-for-agent

- [ ] `docs/adr/0017-the-export-engine-speaks-commands-and-renders-one-export-payload.md` is authored, documenting the command surface, headless export core, bridge purge, and `AbortSignal` cancellation.
- [ ] `scripts/check-doc-anchors.mjs` passes cleanly, confirming all cited symbols in ADR-0017 resolve against `src/`.
- [ ] `scripts/check-glossary.mjs` and `scripts/check-testids.mjs` pass cleanly with zero violations.
- [ ] Visual regression check confirms class tokens and rendered layouts at desktop 1440×900 and mobile 390×844 remain identical to `view_target/stitch.html`.
- [ ] Full test suite passes green via `npm run test:report`.
- [ ] Production build (`npm run build`) is fresh, satisfying `check:dist-fresh`.
- [ ] Status in `.scratch/export-engine/spec.md` is updated to `resolved-in-full`.
