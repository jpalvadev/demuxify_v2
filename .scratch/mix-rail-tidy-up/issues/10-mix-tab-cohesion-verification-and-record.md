# 10: Mix Tab cohesion — verification and record

**What to build:** the whole amendment verified end to end: one screenshot of the stage would now show one honest **Playhead**, one clock, and rails in the order the work is done. This ticket is where the increment's green is promised: the full check cycle re-runs green on the final commit, and every parity guard the amendment claimed holds.

**Blocked by:** 07, 08, 09 (all three deltas must be in before the whole increment can be asserted green).

**Status:** resolved-in-full

- [x] Full pre-commit chain green on the final commit (lint-staged, glossary, doc-anchors, test-fixtures, testids, retired-affordances, typecheck, suite).
- [x] Suite shape matches the plan: one net-new test (the live mirror), plus retargets of the readout-absence and rail/picker location assertions; everything else untouched.
- [x] `npm run check:testids` loses nothing: every pinned testid around the touched rails resolves (picker, confidence line, tap lane's four), and the dead spine readout — carrying no testid — is proven gone by absence pins, not by a lost presence pin.
- [x] `npm run check:retired-affordances` refuses a reintroduced second clock (the spine header readout marker added on ticket 07) and the pre-existing bans stay.
- [x] Parity guards green without edits: bundleZip and ExportDialog Click Track tests, the **Stem Strip** seam, the engine mixer-state fixtures (position subscription consumed, never edited), the Mix-Tab scrub pins, and every export encoder.
- [x] `npm run check:doc-anchors` owes nothing: no `NAME = <number>` record moved; the ADR-0011 replays are not owed (no derived **Beat Grid** number moved).
- [x] The five tickets carry their dead-MCP look records (agent-authored fallback per `docs/agents/open-design-mcp.md`, as required by `AGENTS.md`) — the record scan finds it on 07, 08 and 09.
- [x] A final commit message records the increment; spec.md's Amendment Status line flipped to resolved-in-full.

## Comments

**2026-11-03 — verification record (branch `mix-tab-cohesion`, fifth and final commit).** One screenshot of the Mix stage now shows one honest **Playhead**, one clock, and rails in the order the work is done.

**Chain:** the full pre-commit chain re-ran green on every one of this increment's five commits (`7174472`, `92a7805`, `39da3c4`, `931b7b2`, this one) — prettier/lint-staged → `check:glossary` → `check:doc-anchors` → `check:test-fixtures` → `check:testids` → `check:retired-affordances` → `typecheck` → suite, ~26 s per pass. Final suite: **359 passed / 0 failed across 40 files**.

**Suite shape:** exactly one net-new test, as planned — `App.test.tsx` 48 → 49 (`"mirrors live Playhead to the spine: press play, no mixer event, the spine walks"`). The per-file counts of the touched seams otherwise hold still: `MasterWaveform.test.tsx` 7, `StemPlayer.test.tsx` 19, `stemPlayerTimeStretch.test.tsx` 9. The retargets are name-and-location only: the spine seam's head test renamed to "renders canvas element with the label and chip but no header clock" and gained its absence pins; the **Time-Stretch** anchor's duration-display test re-homed its readout from the dead spine clock to the **Transport** row; the **Stem Player** rail-shape test now renders with ranked candidates live and asserts the picker island absent from the lane root; the honest-ranking test pins the new picker **Rail**'s role/name and its position before the **Transport** row; the whole-app "places each tool in its Tab home" seam walks spine → tap lane → picker **Rail** → **Transport** row → **Stem Strip** → **Click Track** **Rail** → **Time-Stretch** and carries the lane-collapse class-token pins.

**`check:testids`:** 66 presence pins across 43 test files against 19 rendered ids — up from 59 pins on `main`, and every one of the seven new pins is an _order_ pin this increment added deliberately (the tap strip, the picker **Rail**, the **Transport** row, the **Stem Player** region and the rate slider in the chain walk). Nothing lost resolution, nothing dangling: the picker, the confidence line, the **Hand Calibration** strip/readout/confirm/reset all still resolve, and the new ids (`tempo-candidates-rail`, `transport-row`) are rendered ids the gate is one-way about — extra declared ids never trip it. The dead spine readout carries no **testid** in life or in death, so its absence is proven by the absence pins plus the `check:retired-affordances` class-token ban, not by a lost presence pin.

**`check:retired-affordances`:** five bans green, and the new one does refuse the second clock — pattern `/flex items-center gap-1 font-semibold/` (the spine header's `mm:ss / mm:ss` group's class string), ban reason citing **ADR-0013** ("the **Transport** is the Mix Tab's only visible clock, and a second…"). The pre-existing bans stay: **Downbeat** axis, Meter selector, **Click Track** mute control, **Formant** pill-slider, spine time readout.

**Parity guards:** green by construction, not by repair — `git diff --name-only main..HEAD` over the whole increment names 8 source-of-truth files (`src/App.tsx`, `src/components/MasterWaveform.tsx`, `src/components/StemPlayer.tsx`, `src/components/BeatGridTapCalibration.tsx`, three test seams, `scripts/check-retired-affordances.mjs`) plus docs and tickets. The engine (`src/lib/stemPlayerEngine.ts`, whose position subscription the **Stem Player** only _consumes_), `lib/bundleZip`, the **Export Dialog** seams, the **Stem Strip** component and its test, the mixer-state fixtures, the Mix-Tab scrub pins and every export encoder are byte-identical to `main`.

**`check:doc-anchors`:** owes nothing. The one `NAME = <number>` span this increment wrote — `PLAYHEAD_REPAINT_CEILING_MS = 66` in **ADR-0013** — resolves against the constant `src/components/MasterWaveform.tsx` actually runs with, which is exactly the drift the gate exists to catch. No derived **Beat Grid** number moved (`src/lib/beatGridRepair.ts` untouched), so ADR-0011's two replays (`npm run verify:beat-grid-anchor`, `scripts/check_bpm.py`) are not owed; they stay outside the commit chain by design.

**Dead-MCP look records:** the scan finds the agent-authored fallback record on tickets `07`, `08` and `09` (the only three tickets with a look to claim — `06` is a record and `10` is verification), as required by `AGENTS.md`'s OpenDesign mandate and `docs/agents/open-design-mcp.md`: the MCP answered nothing this session, its first light `list_projects` call errored, and no doomed design call was re-paid per ticket.

**spec.md:** the Amendment's Status line flipped `ready-for-agent` → `resolved-in-full`, and the spec header's parenthetical about the Amendment flipped with it so the file cannot claim an open increment over a closed set of tickets.

**Review-pass addendum (same branch, one later commit):** the inline Standards + Spec review of `main...HEAD` found the mirror test short on two Testing-Decisions pins at the whole-app Mix seam — the spine block's clock absence and its `aria-valuetext` face. Both were added **inside the existing mirror test** (suite shape untouched: 359, still one net-new) and committed as the review pass; the spine face pin records the sibling trap: `0:03` on the spine against the Transport's `00:03`.
