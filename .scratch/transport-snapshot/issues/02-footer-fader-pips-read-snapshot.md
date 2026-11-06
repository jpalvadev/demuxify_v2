# 02: Footer Master fader, % readout, and Peak Pips read the snapshot

**What to build:** The footer's Master fader drives the master bus through the module's `setMasterVolume` command; the % readout, the fader's value, and the **Peak Pips** all read the snapshot's `masterVolume` and `levels`. Every master-volume restatement — from the Mix rail, a restore, or the fader itself — flows through the module to the readers, whoever fired it. Both footer mirror states (`footerMasterVolume`, `footerPeakLevels`) are deleted. The mixer bridge keeps its meaning and cadence inside the module: it feeds master-volume restatements only, never per-frame, so Session auto-save churns exactly as before.

**Blocked by:** 01 (the module, live adapter, and command path must exist).

**Status:** ready-for-agent

- [ ] Fader input dispatches `setMasterVolume`; the engine's master bus is driven through the live adapter
- [ ] % readout and slider value read the snapshot's `masterVolume`; Peak Pips L/R read the snapshot's `levels` with the rise-fast/fall-slow coalesced behavior byte-identical
- [ ] The mixer bridge's master-volume restatements land on snapshot readers (Mix rail, restore, fader) — proven by an App-seam test: scripted restatement, % readout follows, no disc involvement
- [ ] `footerMasterVolume` and `footerPeakLevels` mirror states deleted
- [ ] Mixer bridge fires no per-frame traffic; sessionStore mixer-bridge/save-cadence tests green untouched
- [ ] Footer pins (`footer-master-volume`, `footer-master-percent`, the pip pins) keep resolving; accessible names unchanged; native-slider rule holds (pseudo-thumb ban)
- [ ] **Stem Player**'s levels/mixer channels byte-unchanged — its component tests green untouched
- [ ] Gates green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`

## Comments
