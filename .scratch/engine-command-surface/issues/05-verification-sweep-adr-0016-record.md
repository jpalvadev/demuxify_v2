# 05: Verification sweep + ADR-0016 authoring + ADR-0012/0013 amendment record

**What to build:** The increment is proven byte-for-byte behavior-preserving and recorded. Every parity-guard
suite is green untouched, the full pre-commit chain is green, the stitch-skin screenshot loop shows zero
class-token diff at desktop 1440×900 and mobile 390×844, and the records are authored: **ADR-0016** ("the
Player Engine speaks commands and reports one Mixer State") with the considered options (shallow surface
kept, split snapshots, purge-all-getters, UI-side exclusivity), the append-only **ADR-0012** amendment
(exclusivity enforcement now lives inside `applyMixer`; public pair verbs retired; enforcement names kept
private), and the append-only **ADR-0013** amendment (the player's channels survived byte-unchanged, its
mirrors died inside the player, zero new channels). The spec's status records the landing.

**Blocked by:** 01, 02, 03, 04.

**Status:** ready-for-agent

- [ ] Parity guards green with zero retargets across the whole roster: `StemPlayer.test.tsx` (21),
      `stemPlayerTimeStretch.test.tsx` (9), `App.test.tsx` (60), `transportBridge.test.ts` (11),
      `StemStrip.test.tsx`, `MasterWaveform.test.tsx`, `sessionStore.test.ts`
- [ ] Retarget roster is the only suite churn: `stemPlayerEngine.test.ts` (42), `stemPlayerSignalsmith.test.ts`
      (3), `mobileLightweightEndToEnd.test.ts` (7) — and every red they turn is fixed as an interface
      retarget, never as a behavior edit
- [ ] Full pre-commit chain green: typecheck, full suite via `test:report`, `check:glossary`,
      `check:doc-anchors`, `check:test-fixtures`, `check:testids`, `check:retired-affordances`,
      `check:dist-fresh` (dist rebuilt)
- [ ] stitch-skin loop: running app screenshotted at desktop 1440×900 and mobile 390×844 via
      `scripts/shot.mjs` / `scripts/shot-mix.mjs`, diffed against the `view_target/` targets — **zero
      class-token diff**, zero label/aria/copy drift, targets untouched (read-only rule)
- [ ] ADR-0016 authored in house format: decision, context (47→11 verb surface, one snapshot), considered
      options, consequences; names the graph probe as the single named exception to node-getter ban
- [ ] ADR-0012 amendment appended (append-only): enforcement moved into the mixer command, public pair
      verbs retired, private enforcement names keep the citation live; historical-skip lines written for
      any retired identifier the ADR cites
- [ ] ADR-0013 amendment appended: channels byte-unchanged, player mirrors die inside the player, zero new
      channels, mixer bridge never fires on playhead/levels transitions (cadence rule re-affirmed)
- [ ] GLOSSARY.md carries **Player Engine** and **Mixer State** (already written 2026-11-06 during
      grilling) — verify `check:glossary` reads them clean
- [ ] Beat-grid anchor + BPM replays NOT run (spec decision: snap tolerance and ADR-0011 numbers untouched)
- [ ] Spec status updated to record the increment resolved (tickets 01–05); every ticket carries its
      "no new look rendered; skin byte-untouched" record
- [ ] Final commit gated green on branch `engine-command-surface`

## Comments

- (agent, at authoring): Q20 settled the gate list, Q21 the design-source record, Q22 the sequencing note.
  Candidates 2–5 of the architecture report stay untouched — recorded in the spec's Further Notes.
