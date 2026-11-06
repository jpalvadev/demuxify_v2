# 02: Footer Master fader, % readout, and Peak Pips read the snapshot

**What to build:** The footer's Master fader drives the master bus through the module's `setMasterVolume` command; the % readout, the fader's value, and the **Peak Pips** all read the snapshot's `masterVolume` and `levels`. Every master-volume restatement — from the Mix rail, a restore, or the fader itself — flows through the module to the readers, whoever fired it. Both footer mirror states (`footerMasterVolume`, `footerPeakLevels`) are deleted. The mixer bridge keeps its meaning and cadence inside the module: it feeds master-volume restatements only, never per-frame, so Session auto-save churns exactly as before.

**Blocked by:** 01 (the module, live adapter, and command path must exist).

**Status:** resolved

- [x] Fader input dispatches `setMasterVolume`; the engine's master bus is driven through the live adapter
- [x] % readout and slider value read the snapshot's `masterVolume`; Peak Pips L/R read the snapshot's `levels` with the rise-fast/fall-slow coalesced behavior byte-identical
- [x] The mixer bridge's master-volume restatements land on snapshot readers (Mix rail, restore, fader) — proven by an App-seam test: scripted restatement, % readout follows, no disc involvement
- [x] `footerMasterVolume` and `footerPeakLevels` mirror states deleted
- [x] Mixer bridge fires no per-frame traffic; sessionStore mixer-bridge/save-cadence tests green untouched
- [x] Footer pins (`footer-master-volume`, `footer-master-percent`, the pip pins) keep resolving; accessible names unchanged; native-slider rule holds (pseudo-thumb ban)
- [x] **Stem Player**'s levels/mixer channels byte-unchanged — its component tests green untouched
- [x] Gates green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`

## Comments

- **Resolved 2026-11-06 in commit `1726ade` (combined `transport-snapshot 01+02`).**
- Fader command path: `handleFooterMasterVolumeChange` crosses `bridge.setMasterVolume(volume)` and
  the live adapter restates the snapshot on the spot (drag-tracks-fader, as before); the engine's
  echo back through the mixer bridge lands the same value — an equal restatement, a no-op publish.
  Restore (`handleResumeSession`) and every mixer bridge fire now land on
  `liveTransportBridge.restateMasterVolume`.
- Pips retarget: the peak-pips test's `MeterAudioContext` class-swap (it faked shell facts the
  scripted adapter covers) is retired; the test now pushes a coalesced stereo sample
  (`push({ levels: { left: 0.75, right: 0.3 } })`) and asserts the honest L>R ladder + dark-on-
  silence, with the 6-segment pin intact. Rise-fast/fall-slow meter behavior stays the engine's,
  proven by the untouched `stemPlayerEngine` meter tests.
- New App-seam scripted test: fader drag crosses exactly `[{ type: "setMasterVolume", volume: 0.6 }]`
  onto the module, restatement paints % + slider, clamp end paints 0% — no disc, no audio machinery.
  The live-engine fader test (Export-panel mirror proof) survives untouched.
