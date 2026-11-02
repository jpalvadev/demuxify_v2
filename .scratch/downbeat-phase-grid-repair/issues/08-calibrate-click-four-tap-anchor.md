# 08: Calibrate the Click — four taps anchor the Beat Grid by hand

**What to build:** When every automatic reading is wrong on the user's material, the Click Track gets a 100%-reliable manual route: the user taps four beats on the groove they hear (Mix Tab affordance on the waveform spine), the engine derives pulse (median of the three inter-tap deltas) and phase (first tap as the Downbeat anchor) from the taps, and the Beat Grid re-anchors to that lattice through the ticket 06 re-lock machinery — same single pass, hint = derived BPM, plus a phase re-anchor at the engine seam. The rail says "calibrated by hand", never "auto".

**Blocked by:** 06 (re-lock hint seam to extend) — and an OpenDesign run for the tap-capture UI view (MANDATORY per AGENTS: new UI must be designed through the OpenDesign MCP artifact, then ported; record the run on this ticket).

**Status:** open

- [ ] OpenDesign run: tap-capture affordance on the Mix Tab waveform (four taps, live pulse readout, confirm/reset).
- [ ] Engine seam: `calibrateClickGrid(tapsSec)` derives pulse/phase; taps at <0.25 s or >2.5 s apart or <3 taps are rejected honestly (never a silent half-calibration).
- [ ] Re-anchor pins: mock-AudioContext `source.start(when, offset)` tracers prove clicks land on the calibrated lattice, not the Detector's.
- [ ] Session persistence: a calibrated grid survives Session Recovery (sibling to `tempo`, marking the reading as hand-set).
- [ ] Full suite + typecheck + glossary green on the commit.

## Comments

- Motivation measured (ADR-0011 Amendment): after the pickup-rule fix the intro damage collapsed (18→1 bad clicks in 0–10 s) but the tail stays (54/170 clicks >80 ms from any hit, RAW grid identical) — detection-quality territory. Ticket 07 attacks it automatically; this one is the guaranteed escape hatch when the automatic route misses: four taps by ear beat any tracker.
- Keep the axes apart: taps anchor pulse+phase only; the Downbeat −/+ rotation stays the existing accent control riding on top.
