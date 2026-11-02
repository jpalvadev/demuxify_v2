# 03: Beat Grid hybrid snap repair — tolerance derived, recorded, and proven on real audio

**What to build:** The Click Track stops sliding mid-song: before the complete message leaves the Tempo Detector worker, the raw tracker's Beat Grid is repaired by hybrid snap against the uniform pulse implied by the chosen BPM — each tracked beat trusted within a tolerance, slips relocated to the pulse, consecutive double-gaps filled at the pulse position, and passages that fluctuate genuinely together keep their human-feel positions. The **repaired** grid is the grid every consumer sees: playback, rail readout, Session persistence, export bytes, and the real-audio verification seam alike. The snap tolerance is not a blind number: verification runs of the reference Source Mix against the librosa anchor fix it, and ADR 0011 records the derived value.

**Blocked by:** 02 (Automatic Downbeat Phase — the widened complete message and synthesis rule land first; repair keeps that shape intact).

**Status:** resolved

- [x] Repair helper lives in app code on top of the tracker output (no new dependencies); the raw tracker positions never cross the worker boundary — `beatGrid` in the complete message is the repaired grid.
- [x] Trust-within-tolerance: a raw beat within tolerance of the pulse keeps its exact position; a clear slip relocates; a run of consistently fluctuating beats is preserved as a group. (`src/__tests__/beatGridRepair.test.ts` — 38/38 unit assertions: keep/slip/relocate/fill/rubato-group cases.)
- [x] Double-gaps (a beat the tracker missed in a loud passage) are filled with the pulse position. (Unit case: k≥2 lattice gaps insert skipped pulses; non-monotone input is dropped.)
- [x] Tolerance derivation step: run the real-audio verification seam on the reference track, compare repaired intervals against the anchor (107.7 BPM / 503 beats / 294.1 s), fix the tolerance that makes slips repaired and genuine rubato preserved, and append the recorded value to ADR 0011's tolerance clause. → recorded `SNAP_TOLERANCE_SEC = 0.08 s` (see ADR-0011 Consequences and the Comments below).
- [x] Verification seam assertions updated to the repaired grid: the real-audio seam now asserts the repair guard invariant (every emitted gap within pulse ± `SNAP_TOLERANCE_SEC`, imported as the SAME exported constant the worker applies); the existing ~0.557 s median and doubling-median assertions stay honest. Honest framing from the runs: the hinted tracker absorbs mild defects, so repair is a NO-OP on both the reference-track and surrogate real grids — the seam's evidence is the guard invariant, and the slip/fill/rubato mechanics carry their evidence in the unit file.
- [x] Downbeat Phase from ticket 02 composes with the repaired grid: phase rotation still moves accents only, positions still sit on the repaired grid. (Engine synthesis takes positions + phase separately; unit assertions pin accents-on-phase without touching positions; the worker emits phase beside the repaired grid.)
- [x] Session-persisted grid is the repaired grid (existing store round-trips stay green with the new positions — the store just carries whatever grid the detector emitted, which is now the repaired one).
- [x] Full suite + typecheck + glossary green on the commit.

## Comments

- Locked-uniform grid rejected outright (ADR 0011): it contradicts the Beat Grid glossary definition and flattens real phrasing — the repair must breathe where the music breathes.
- The Beat Grid glossary entry ("carries where the beats actually fall… not a flat pulse") is the spec this repair honors; only the _slips_ (errors against the pulse) get repaired.
- Tolerance recording is a hard acceptance criterion: the ADR clause "recorded here once the runs fix it" must be satisfied, not left open at feature close. → satisfied: 0.08 s recorded in ADR-0011 (below).

### Verification run record (tolerance derivation, 2026-11-02)

Harnesses (disposable, at repo root, deleted before the commit — `scripts_verify_snap.mjs`, `scripts_probe_tracker.mjs`) fed the real `audioslave_stone.mp3` (294.1 s) through the real `beatTrack` and compared against the librosa anchor (107.7 BPM / 503 beats / 0.38–279.71 s span, anchor trims the final ~14 s):

- Real beatTrack@107.7: 530 beats; ALL 529 gaps k=1 and within ±0.014 s of the 0.5571 s pulse → repair is a NO-OP on the real hinted grid.
- Raw-vs-anchor deviation: p50 0.046 s, p90 0.128 s, p95 0.302 s; outlier windows: beat 0 (0.38 s), beats 378–405 = 210–225 s (peak 0.30 s = anchor rubato the tracker never shows), beats 505–529 = 280–294 s (anchor-trim artifact, not double-tracking).
- Anchor's own interval band: 0.4992–0.6153 s = pulse ±0.058 s — genuine fluctuation the repair must preserve.
- Defect probe (surrogate with planted skip/slip/rubato): the HINTED beatTrack re-derives its own near-uniform lattice (22 beats, 0.5108–0.6037 s), absorbing planted defects — so at the worker seam repair is no-op even with defects planted; the mechanics (0.31 s slip relocated, skipped pulse inserted, rubato group kept intact) are pinned in `src/__tests__/beatGridRepair.test.ts` (38 unit assertions).
- Chosen tolerance 0.08 s: above the natural band (±0.058 s anchor rubato; ±0.014 s real tracker), below real slips (0.128 s p90 raw-vs-anchor, 0.30 s rubato-window peak, 0.31 s planted slip).

### Replay correction (2026-11-02, `npm run verify:beat-grid-anchor`)

The kept replay harness `scripts/verify_beat_grid_anchor.mjs` (ffmpeg-decoded channel 0 → real `beatTrack` @ 107.7 → `repairBeatGrid` transpiled from `src/lib/beatGridRepair.ts`) does NOT reproduce the "ALL 529 gaps within ±0.014 s" line above: 507/529 sit in that band; the raw hinted grid carries 22 body slips (max ±0.0350 s) plus a 0.3483 s phase lead-in at beat 0. What does replay: 530 beats / 529 intervals with all k=1 (no double-gaps), repair a STRUCTURAL no-op (530 → 530, nothing inserted/dropped — but beats relocated up to 0.2088 s), and the seam guard (worst repaired gap off lattice 0.0767 s ≤ the exported 0.08 s). The tolerance choice still stands (±0.0350 s measured natural band < 0.08 s < 0.128 s p90 / 0.31 s planted slip); ADR-0011 carries the matching Addendum.

### Pickup rule — lead-in cascade was a defect, fixed (2026-11-02)

Measured with the shipped pipeline vs real-hit evidence (librosa strong onsets as truth): the chaining-off-last-EMITTED-beat rule let the 0.3483 s lead-in relocate beat 1 and then re-measure every later gap against the relocated beat — 25 beats moved up to 0.2088 s (0.35 s..13.84 s), 21 intro clicks >80 ms from any hit, while the body (20–200 s) sits median 39 ms on the hits. Fix at the `beatGridRepair.test.ts` seam (red → green): an off-lattice gap keeps the beat when the beat vouches for itself (≥ half pulse from the previous AND the following gap on-lattice from the beat) — pickup/anacrusis kept verbatim, lattice resumes; only isolated anomalies relocate onto the chain. Amended replay: 530 → 530, 0 beats relocated, exactly one off-lattice gap (the documented 0.2088 s lead-in), probe still re-inserts. Tail damage (54/170 clicks in 210–294 s) is identical in the RAW grid — detection quality, not repair; out of scope here (see ADR-0011 Amendment).
