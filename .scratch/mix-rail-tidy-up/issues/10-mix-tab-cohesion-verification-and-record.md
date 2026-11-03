# 10: Mix Tab cohesion — verification and record

**What to build:** the whole amendment verified end to end: one screenshot of the stage would now show one honest **Playhead**, one clock, and rails in the order the work is done. This ticket is where the increment's green is promised: the full check cycle re-runs green on the final commit, and every parity guard the amendment claimed holds.

**Blocked by:** 07, 08, 09 (all three deltas must be in before the whole increment can be asserted green).

**Status:** ready-for-agent

- [ ] Full pre-commit chain green on the final commit (lint-staged, glossary, doc-anchors, test-fixtures, testids, retired-affordances, typecheck, suite).
- [ ] Suite shape matches the plan: one net-new test (the live mirror), plus retargets of the readout-absence and rail/picker location assertions; everything else untouched.
- [ ] `npm run check:testids` gains nothing and loses nothing: every pinned testid around the touched rails resolves (picker, confidence line, tap lane's four), and the dead spine readout — carrying no testid — is proven gone by absence pins, not by a lost presence pin.
- [ ] `npm run check:retired-affordances` refuses a reintroduced second clock (the spine header readout marker added on ticket 07) and the pre-existing bans stay.
- [ ] Parity guards green without edits: bundleZip and ExportDialog Click Track tests, the **Stem Strip** seam, the engine mixer-state fixtures (position subscription consumed, never edited), the Mix-Tab scrub pins, and every export encoder.
- [ ] `npm run check:doc-anchors` owes nothing: no `NAME = <number>` record moved; the ADR-0011 replays are not owed (no derived **Beat Grid** number moved).
- [ ] The five tickets carry their dead-MCP look records (agent-authored fallback per `docs/agents/open-design-mcp.md`, as required by `AGENTS.md`) — the record scan finds it on 07, 08 and 09.
- [ ] A final commit message records the increment; spec.md's Amendment Status line flipped to resolved-in-full.
