# 06: Record at porting start — ADR-0013 authored, glossary verified

**What to build:** the decision record lands before any code moves, per the amendment's "Record before coding" rule. **ADR-0013 "Mix Tab cohesion and the single Playhead readout"** is authored, recording the three trade-offs a future reader will otherwise grieve about: why exactly one `mm:ss` readout survives, why the **Transport** holds the clock instead of the **Master Waveform** spine, and why the **Tempo Detector** candidate picker is its own **Rail** rather than living inside the **Click Track** lane. The **GLOSSARY** entries for **Playhead**, **Rail** and **Stem Strip** plus the **Hand Calibration** tool/decision pairing were written the moment they crystallised and already stand — this ticket verifies them, it does not rewrite them.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `docs/adr/0013-mix-tab-cohesion-and-the-single-playhead-readout.md` exists and records: the single-readout rule (one **Playhead**, one clock, the spine's header `mm:ss / mm:ss` group dead), the picker relocation (a **Rail** means identity + its own controls; chips inside the lane root would betray the lane's zero-button shape), and the clock's home (the **Transport** row, because the spine is a scrub surface, not a readout), each with its why.
- [x] The ADR marks [ADR-0008](../adr/0008-four-tab-shell-and-single-toggle-transport.md) as partially superseded for the Mix Tab's rail order and its two competing readouts, in the style of the ADR-0010/ADR-0011 amendments already in the repo — an amendment span on 0008 names what no longer applies (rail order, the two clocks) and what still does (the toggle Transport, the spine as scrub surface), cross-linked from ADR-0013's opening line.
- [x] **GLOSSARY** verified untouched-but-sufficient: **Playhead** (one value, one clock, canonical Source Mix seconds, invariant under Time-Stretch), **Rail** (control group inside a Tab, distinct from the chrome's **Tab Rail**), **Stem Strip** (the per-**Stem** row, mixer block = four Strips plus at most one non-Stem lane), and the **Hand Calibration** entry already recording the decision and the "Calibrate the Click" tool one sentence apart.
- [x] `npm run check:glossary` green with the amendment's vocabulary live in the spec/ADR prose.
- [x] `npm run check:doc-anchors` green — the new ADR records no derived `NAME = <number>` span, so it owes the doc-anchor gate nothing.

## Comments

**2026-11-03 — port record (first commit of branch `mix-tab-cohesion`).** The record commit lands the vocabulary ahead of any code: **ADR-0013** authored (single-readout rule, picker-not-in-lane rule, clock's home in the **Transport** — each with its why, plus the considered options and the rejected mobile-block per ADR-0009's drifting-pair lesson); an amendment span on **ADR-0008** marks the rail order and the two competing readouts as partially superseded while keeping its still-live claims; **GLOSSARY.md** gains **Playhead**, **Rail** and **Stem Strip** and extends **Hand Calibration** with the tool/decision pairing. `check:glossary` and `check:doc-anchors` both green on the amended docs. No OpenDesign run: the MCP answered nothing this session, so the record cites the dead-MCP fallback (the look itself is recorded agent-authored on tickets `07`–`09`).
