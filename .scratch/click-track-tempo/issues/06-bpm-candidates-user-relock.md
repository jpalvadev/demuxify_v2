# 06: BPM candidates ranked and user-correctable — selection re-locks the Beat Grid

**What to build:** The Mix-tab BPM readout shows the top candidate plus ranked alternatives with confidence. The user can pick an alternative; the Tempo Detector re-runs with that tempo as the hint and the Beat Grid re-locks — clicks audibly move to the other metric level (e.g. 107.7 ↔ its doubling ~215.4 on the reference track).

**Blocked by:** 04 (Click Track lane in the Stem Player — rail, synthesized clicks, Meter, stretch lock).

**Status:** ready-for-agent

- [ ] Rail readout: top candidate, ranked alternatives, per-candidate confidence; nothing presented as certain when candidates are ambiguous.
- [ ] Picking a candidate re-runs the tracker with the tempo as hint; the new Beat Grid replaces the old one in the Session state (session persistence from 03 keeps working).
- [ ] Click Track re-synthesizes from the re-locked grid immediately — no stale clicks.
- [ ] Real-audio end-to-end seam extended: selecting the metric-doubling candidate halves median click interval (~0.557 s → ~0.279 s on the reference track, tolerance-based).
- [ ] Re-lock runs off the main thread like the original pass; UI stays responsive mid-relock.
- [ ] Repeated switching (up/down octave, back and forth) leaves session state consistent (grid matches chosen tempo, exported file matches chosen grid).

## Comments
