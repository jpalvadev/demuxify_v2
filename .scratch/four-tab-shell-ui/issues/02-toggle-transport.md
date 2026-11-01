# 02: Toggle Transport

**What to build:** The Mix Tab's Transport is a single Play/Pause toggle whose icon shows the action coming next — ▶ while paused, ⏸ while playing — and pressing it (or Space) toggles playback either way. The dedicated Seek-to-start button is deleted from the Stem Player row; scrubbing the Master Waveform spine keeps repositioning the playhead through the existing app↔player bridge. The mono time readout and Master Volume stay in the Transport row. The bridge interface and engine-facing code are untouched.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] One Transport button in the Mix Tab; no separate Play, Pause, or Seek buttons
- [x] Button icon reflects the action coming next; accessible name stable; pressed state exposed for assistive tech
- [x] Space key toggles the same control
- [x] Toggle drives the Stem Player engine's play/pause through the existing bridge
- [x] Spine scrubbing still repositions the playhead in the Mix Tab
- [x] Stem Player seam tests updated: Play/Pause pair and Seek button tests replaced by toggle assertions; engine still receives play/pause calls
- [x] App-level tests assert a single toggle in the Mix region

## Comments

- Toggle lives in the Stem Player Transport row: `aria-label="Play/Pause"` (single stable
  name), `aria-pressed` bound to playing state, icon swaps ▶/⏸ by state, click/Space both
  route through the bridge's dedicated `handlePlay`/`handlePause` actions. Seek-to-start
  button deleted; the Mix Tab spine's `seek` callback is the only timeline surface.
  Mono time readout and Master Volume fader stay in the row. `TransportControls`
  signature untouched; engine untouched. Purge/Export-Stems buttons deliberately
  deferred to tickets 04/03.
- Seam tests: engine `play`/`pause` spies alongside aria-pressed flips; app seam asserts
  exactly one toggle in the Mix region and absence of Play/Pause/Seek buttons.
