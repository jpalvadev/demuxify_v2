# 04: Verification Sweep & ADR-0018 Recording

**What to build:** Formalize the Session Manager architecture in an Architectural Decision Record (**ADR-0018**) and execute the repository verification sweep across code, documentation, and pre-commit gates. This ensures that all code identifiers, glossary terms, test IDs, and built artifacts pass without drift, verifying that no residual references to retired `createSessionAutoSaver` or loose session state patterns remain.

**Blocked by:** 03: App Integration & Shell Refactor (Bridge Purge in App.tsx).

**Status:** ready-for-agent

- [ ] `docs/adr/0018-the-session-manager-speaks-commands-and-coordinates-in-memory-state-and-persistence.md` is authored, documenting context, decision, considered options, and consequences in line with ADR-0003, ADR-0013, ADR-0016, and ADR-0017.
- [ ] Production build (`npm run build`) is executed to ensure `dist/` is fresh and compliant with `check:dist-fresh`.
- [ ] All pre-commit guardrails pass cleanly:
  - `npm run check:glossary`
  - `npm run check:doc-anchors`
  - `npm run check:testids`
  - `npm run check:retired-affordances`
  - `npm run check:dist-fresh`
- [ ] Full Vitest suite passes green via `npm run test:report`.
