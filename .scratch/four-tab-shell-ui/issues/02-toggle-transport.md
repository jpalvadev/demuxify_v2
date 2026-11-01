# 02: Toggle Transport

**What to build:** The Mix Tab's Transport is a single Play/Pause toggle whose icon shows the action coming next — ▶ while paused, ⏸ while playing — and pressing it (or Space) toggles playback either way. The dedicated Seek-to-start button is deleted from the Stem Player row; scrubbing the Master Waveform spine keeps repositioning the playhead through the existing app↔player bridge. The mono time readout and Master Volume stay in the Transport row. The bridge interface and engine-facing code are untouched.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] One Transport button in the Mix Tab; no separate Play, Pause, or Seek buttons
- [ ] Button icon reflects the action coming next; accessible name stable; pressed state exposed for assistive tech
- [ ] Space key toggles the same control
- [ ] Toggle drives the Stem Player engine's play/pause through the existing bridge
- [ ] Spine scrubbing still repositions the playhead in the Mix Tab
- [ ] Stem Player seam tests updated: Play/Pause pair and Seek button tests replaced by toggle assertions; engine still receives play/pause calls
- [ ] App-level tests assert a single toggle in the Mix region
