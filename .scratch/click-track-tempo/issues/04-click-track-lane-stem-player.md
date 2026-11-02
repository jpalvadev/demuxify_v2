# 04: Click Track lane in the Stem Player — rail, synthesized clicks, Meter, stretch lock

**What to build:** The Mix tab gains a Click Track rail (ported from the 01 artifact): toggle defaulting to **off**, mute/volume like a Stem lane, Meter selector 2/4/3/4/4/4/6/8 defaulting to 4/4. When enabled, a synthesized metronome plays locked to the Beat Grid — deeper accented downbeats, lighter other beats — and it speeds/slows in lockstep with Time-Stretch. It is not a Stem and never becomes one.

**Blocked by:** 01 (OpenDesign run — Click Track rail + Tempo readout look), 02 (Tempo Detector — automatic analysis at decode with Separate-tab readout).

**Status:** closed

- [x] Rail ported from the 01 artifact; **look is agent-authored, not an OpenDesign run** — the ticket-01 run died and its retry errored (see ticket 01 FALLBACK RECORD), so there is no run id or preview URL to cite; the HSL CSS-variable token architecture of the Tab Shell stays intact (`border-primary/*`, `bg-secondary/*`, `text-primary`).
- [x] Click Track state is parallel to Stem mixer state: `{ enabled (default off), muted, volume, meter }` (`ClickTrackMixerState` / `ClickTrackMeter` in `src/lib/stemPlayerEngine.ts`); the `StemName` union stays `vocals | drums | bass | other` and `check:glossary` passes for Tempo Detector / Beat Grid / Meter / Click Track.
- [x] Click audio synthesized (no sampled assets): exported `synthesizeClickTrackChannel(grid, meter, sampleRate, durationSec?)` — 0.06 s exponentially-decaying bursts at Beat Grid positions in seconds, downbeat 92 Hz amp 1.0 vs upbeat 640 Hz amp 0.55, accent where `k % beatsPerBar === 0`; deterministic, and the channel is regenerated on Meter change only.
- [x] Engine seam extended (`setBeatGrid` / `setClickTrackEnabled` / `toggleClickTrack` / mute / volume / Meter): lane-on adds exactly one GainNode and one BufferSource, enabling/disabling never touches the four Stems' gains or sources; the lane stays out of the Stem audio graph (its gain hangs off the Master Gain only).
- [x] Time-Stretch pair extended: the click source is a mono BufferSource at `playbackRate = tempo`, recreated in lockstep on `play()`/`seek()`/`setTempo()` (both worklet-migration branches), and no rate control exists in the rail — the UI seam asserts one and only one Click Track slider (the volume fader).
- [x] Rubato check on the reference-track seam (`src/__tests__/realAudioMix.test.ts`): the Beat Grid from the worker is fed to `synthesizeClickTrackChannel`, clicks land one-per-grid-position (within ~10 samples), and the grid is provably rubato (max drift from a flat stride 0.026 s, interval spread 0.557 s median vs 0.534 s min) — clicks follow the beats where they actually fall, not a flat BPM re-derivation.
- [x] Mix tab stays grayscaled until Stems exist; the rail only exists once Mix is live (App seams: no `click-track-rail` while the Mix cell carries "no Stems yet", rail present after Separation).

## Comments

- Design source: **none available** — the ticket-01 OpenDesign run `441c6b4f-…` was cancelled (`daemon_shutdown`) and the retry run `043c2560-…` errored (`Unknown tool 'open-design.get_run'`), so per the "OpenDesign MCP — when it dies for good" rule the remaining look was handed to the agent. This ticket's rail (Badge chip + mono Beat Grid readout + ♪ switch / M mute / volume fader / Meter selector) is agent-authored and recorded as such.
- The rail lives inside `StemPlayer` (not the app shell): Click Track controls exist only once the Mix is live (ADR-0010 story 14).
- The Beat Grid is swapped in place by a dedicated `useEffect([beatGrid])`, so ticket 06's candidate re-lock keeps mixer settings and the playhead where they were.
- `onClickTrackState` reports the lane state out to the app (`clickTrackStateRef`) — the Session persistence seam ticket 05 needs.
