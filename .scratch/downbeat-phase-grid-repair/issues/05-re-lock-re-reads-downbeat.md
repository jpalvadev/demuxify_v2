# 05: Re-locking to a different BPM candidate re-reads the Downbeat

**What to build:** The user picked the metric doubling and had rotated their −/+ hunt against the old grid; after re-locking, the clicks land on the _new_ Beat Grid's downbeat as the automatic reading judges it — the old nudge, meaningless against halved/doubled positions, is silently dropped. The user can hunt again on the new grid.

**Blocked by:** 02 (Automatic Downbeat Phase — the worker's phase reading is what gets re-run), 04 (−/+ rotation — the nudge that must be discarded has to exist to be discarded).

**Status:** ready-for-agent

- [ ] Picking an alternative candidate re-runs the tracker with the tempo hint as today; the complete relay now carries a fresh Downbeat Phase scored against the _new_ grid — the Session's previous phase (auto-picked or nudged) never carries across.
- [ ] Seam-pinned evidence: after a −/+ hunt at 107.7 then a re-lock to the doubling, the persisted phase equals the new automatic pick, not the old hunt offset; the rail's accents follow the fresh phase while clicks sit on the re-locked grid.
- [ ] Repeated switching (107.7 → doubling → back) keeps state consistent: every re-lock re-reads, every −/+ hunt applies to the current grid only.
- [ ] Off-main-thread invariant preserved: the re-read rides the same worker pass (no extra message round-trip on the main thread); the existing mid-flight cancel/replace behavior stays green.
- [ ] Full suite + typecheck + glossary green on the commit.

## Comments

- ADR 0011 clause honored literally: "re-locking to a different BPM candidate re-reads the automatic Downbeat against the new grid rather than carrying a nudge tuned against the old one."
- Build on the existing re-lock flow (hint re-run, grid replacement, rail follow) — this ticket widens the complete message consumption, it does not restructure the re-lock.
