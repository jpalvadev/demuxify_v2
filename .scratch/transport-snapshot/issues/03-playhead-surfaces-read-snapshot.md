# 03: Playhead surfaces read the snapshot — spine, clock chip, formatter consolidation

**What to build:** Scrubbing the **Master Waveform** spine lands the **Playhead** on every reading surface, and pressing play walks them with zero mixer traffic: the spine, the clock chip, and the Stem Strip position feeds all read the snapshot's `playheadSec`. Scrubs dispatch the module's `seek` verb. The App's `currentTime` mirror state is deleted. One shared `mm:ss` formatter serves the clock chip and every Playhead-reading surface — the twin formatters (already drifting on their clamp rule) consolidate to the single shared formatter. ADR-0013's live-mirror proof survives verbatim at the App seam.

**Blocked by:** 01 (the module, live adapter, and `seek` command path must exist). Parallel with 02 — the Playhead fields are independent of volume/levels.

**Status:** ready-for-agent

- [ ] Spine wiring, clock chip, and Stem Strip position feeds read `playheadSec` from the snapshot through one subscription
- [ ] `currentTime` mirror state deleted; the spine scrub handler dispatches `seek` through the module
- [ ] The ADR-0013 live-mirror App-seam test (press play, no mixer event, the spine's `aria-valuenow` walks off its start) is green
- [ ] One shared `mm:ss` formatter with a single clamp rule serves the clock chip and Playhead-reading surfaces; the twin formatters are retired
- [ ] The Playhead rides the engine's existing position subscription inside the live adapter — no new engine channel, no per-frame mixer traffic
- [ ] The Master Waveform's repaint-ceiling constant is untouched (`check:doc-anchors` green); Master Waveform seam tests green untouched
- [ ] Gates green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`

## Comments
