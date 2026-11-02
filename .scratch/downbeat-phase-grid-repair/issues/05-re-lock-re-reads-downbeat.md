# 05: Re-locking to a different BPM candidate re-reads the Downbeat

**What to build:** The user picked the metric doubling and had rotated their −/+ hunt against the old grid; after re-locking, the clicks land on the _new_ Beat Grid's downbeat as the automatic reading judges it — the old nudge, meaningless against halved/doubled positions, is silently dropped. The user can hunt again on the new grid.

**Blocked by:** 02 (Automatic Downbeat Phase — the worker's phase reading is what gets re-run), 04 (−/+ rotation — the nudge that must be discarded has to exist to be discarded).

**Status:** resolved (landed in ONE commit with ticket 04 — shared beam effect and JSX props)

- [x] Picking an alternative candidate re-runs the tracker with the tempo hint as today; the complete relay carries a fresh Downbeat Phase scored against the new grid, and `startTempoAnalysis`'s completion handler re-points `downbeatPhaseRef.current = result.downbeatPhase ?? 0` on EVERY arriving grid — the previous phase (auto or nudged) never carries across.
- [x] Seam-pinned evidence: App seam test walks a manual −/+ hunt at 107.7 (tag cleared, "Beat 2 of 4") then a re-lock to the doubling — the rail re-pairs to the new pass's own reading ("Beat 3 of 4 · auto", tag back), proving the old hunt offset is dropped and the accents follow the fresh phase on the re-locked grid.
- [x] Repeated switching keeps state consistent: the beam is the PAIR (grid, phase) — `lastBeamGridRef` identity means a fresh grid always re-adopts its auto reading, while the app pushing a manually rotated phase on the SAME grid re-points the deep tone without touching the tag.
- [x] Off-main-thread invariant preserved: the re-read rides the same worker pass (the widened complete message already carries it; no extra round-trip), and the existing mid-flight cancel/replace tests stay green.
- [x] Full suite + typecheck + glossary green on the commit.

## Comments

- ADR 0011 clause honored literally: "re-locking to a different BPM candidate re-reads the automatic Downbeat against the new grid rather than carrying a nudge tuned against the old one."
- Build on the existing re-lock flow (hint re-run, grid replacement, rail follow) — this ticket widens the complete message consumption, it does not restructure the re-lock.
