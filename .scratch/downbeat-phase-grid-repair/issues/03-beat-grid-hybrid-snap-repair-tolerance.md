# 03: Beat Grid hybrid snap repair — tolerance derived, recorded, and proven on real audio

**What to build:** The Click Track stops sliding mid-song: before the complete message leaves the Tempo Detector worker, the raw tracker's Beat Grid is repaired by hybrid snap against the uniform pulse implied by the chosen BPM — each tracked beat trusted within a tolerance, slips relocated to the pulse, consecutive double-gaps filled at the pulse position, and passages that fluctuate genuinely together keep their human-feel positions. The **repaired** grid is the grid every consumer sees: playback, rail readout, Session persistence, export bytes, and the real-audio verification seam alike. The snap tolerance is not a blind number: verification runs of the reference Source Mix against the librosa anchor fix it, and ADR 0011 records the derived value.

**Blocked by:** 02 (Automatic Downbeat Phase — the widened complete message and synthesis rule land first; repair keeps that shape intact).

**Status:** ready-for-agent

- [ ] Repair helper lives in app code on top of the tracker output (no new dependencies); the raw tracker positions never cross the worker boundary — `beatGrid` in the complete message is the repaired grid.
- [ ] Trust-within-tolerance: a raw beat within tolerance of the pulse keeps its exact position; a clear slip relocates; a run of consistently fluctuating beats is preserved as a group.
- [ ] Double-gaps (a beat the tracker missed in a loud passage) are filled with the pulse position.
- [ ] Tolerance derivation step: run the real-audio verification seam on the reference track, compare repaired intervals against the anchor (107.7 BPM / 503 beats / 294.1 s), fix the tolerance that makes slips repaired and genuine rubato preserved, and append the recorded value to ADR 0011's tolerance clause.
- [ ] Verification seam assertions updated to the repaired grid: raw-pass slip/double-gap evidence is shown repaired, intervals match the anchor within the derived tolerance, and the existing ~0.557 s median (107.7 BPM) and doubling-median (~0.279 s) assertions stay honest for re-locked grids.
- [ ] Downbeat Phase from ticket 02 composes with the repaired grid: phase rotation still moves accents only, positions still sit on the repaired grid.
- [ ] Session-persisted grid is the repaired grid (existing store round-trips stay green with the new positions).
- [ ] Full suite + typecheck + glossary green on the commit.

## Comments

- Locked-uniform grid rejected outright (ADR 0011): it contradicts the Beat Grid glossary definition and flattens real phrasing — the repair must breathe where the music breathes.
- The Beat Grid glossary entry ("carries where the beats actually fall… not a flat pulse") is the spec this repair honors; only the _slips_ (errors against the pulse) get repaired.
- Tolerance recording is a hard acceptance criterion: the ADR clause "recorded here once the runs fix it" must be satisfied, not left open at feature close.
