# 03: Playhead surfaces read the snapshot — spine, clock chip, formatter consolidation

**What to build:** Scrubbing the **Master Waveform** spine lands the **Playhead** on every reading surface, and pressing play walks them with zero mixer traffic: the spine, the clock chip, and the Stem Strip position feeds all read the snapshot's `playheadSec`. Scrubs dispatch the module's `seek` verb. The App's `currentTime` mirror state is deleted. One shared `mm:ss` formatter serves the clock chip and every Playhead-reading surface — the twin formatters (already drifting on their clamp rule) consolidate to the single shared formatter. ADR-0013's live-mirror proof survives verbatim at the App seam.

**Blocked by:** 01 (the module, live adapter, and `seek` command path must exist). Parallel with 02 — the Playhead fields are independent of volume/levels.

**Status:** resolved

- [x] Spine wiring, clock chip, and Stem Strip position feeds read `playheadSec` from the snapshot through one subscription
- [x] `currentTime` mirror state deleted; the spine scrub handler dispatches `seek` through the module
- [x] The ADR-0013 live-mirror App-seam test (press play, no mixer event, the spine's `aria-valuenow` walks off its start) is green
- [x] One shared `mm:ss` formatter with a single clamp rule serves the clock chip and Playhead-reading surfaces; the twin formatters are retired
- [x] The Playhead rides the engine's existing position subscription inside the live adapter — no new engine channel, no per-frame mixer traffic
- [x] The Master Waveform's repaint-ceiling constant is untouched (`check:doc-anchors` green); Master Waveform seam tests green untouched
- [x] Gates green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`

## Comments

- **Resolved 2026-11-06 in commit `7db8708`.**
- Spine: `currentTime={snapshot.playheadSec}`; clock chip current/total: `formatTransportClock(snapshot.playheadSec)`
  / duration. App `currentTime` state deleted; `onPlayheadChange` feeds the live adapter's
  `setPlayheadSec`; `handleSeek` (ticket 01's `bridge.seek`) untouched.
- Stem Strip position feeds nuance: the hosted Mix Tab has no player-side time readout at all
  (Stitch skin 07j erased the strip — pinned), and the player's standalone-form readout rides the
  player's own engine subscription (interface byte-untouched). In the app shell every Playhead face
  reads the snapshot through the one bridge subscription.
- Formatter consolidation: new `src/lib/transportClockFormat.ts` (`formatTransportClock`, App's
  clamp-then-floor rule as the single truth — the twins had drifted on the clamp edge: the
  StemPlayer twin printed `NaN:NaN` at Infinity); App's `formatTransportTime` and StemPlayer's
  `formatTime` retired. MasterWaveform's own `m:ss` ruler face stays by design (App.test pins
  `aria-valuetext="0:03"`).
- ADR-0013 live-mirror test survived verbatim (untouched in the diff); new scripted App-seam test
  proves spine + chip move in lockstep off a pushed `playheadSec` (63 → `01:03` / `aria-valuenow="63"`
  / `aria-valuetext="1:03"`).
