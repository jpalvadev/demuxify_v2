# 04: Seeding — restored Session seeds the snapshot, fresh separation resets it

**What to build:** A restored **Session** shows its own truth on the shell immediately: the **Session Recovery** resume seeds the snapshot's `masterVolume` and `playheadSec` from the Session's mixer payload before the **Stem Player** mounts, so the footer never flashes defaults under the player. Completing a separation resets the snapshot to fresh defaults (not playing, Playhead 0, volume 1.0, silent levels). With no player wired, the snapshot reads idle and commands are inert no-ops — the footer disc and fader stay sane on the Separate Tab.

**Blocked by:** 01, 02, 03 (every consumer must be snapshot-driven before seeding covers them all).

**Status:** ready-for-agent

- [ ] Resume seeds `masterVolume` + `playheadSec` from the restored Session's mixer values before the player mounts; footer shows restored values with no default-flash
- [ ] Separation completion resets the snapshot to fresh defaults (playing false, playhead 0, volume 1.0, silent levels)
- [ ] No-player state: snapshot reads idle, commands are inert no-ops — no crash, no phantom play state
- [ ] The snapshot is never a fourth writer of mixer state: persistence keeps its existing single writer (the mixer bridge), auto-save cadence byte-identical
- [ ] Session Recovery / resume suite green; `sessionStore` tests green untouched
- [ ] Gates green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`

## Comments
