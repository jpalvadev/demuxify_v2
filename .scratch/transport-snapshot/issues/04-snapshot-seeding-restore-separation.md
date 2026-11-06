# 04: Seeding — restored Session seeds the snapshot, fresh separation resets it

**What to build:** A restored **Session** shows its own truth on the shell immediately: the **Session Recovery** resume seeds the snapshot's `masterVolume` and `playheadSec` from the Session's mixer payload before the **Stem Player** mounts, so the footer never flashes defaults under the player. Completing a separation resets the snapshot to fresh defaults (not playing, Playhead 0, volume 1.0, silent levels). With no player wired, the snapshot reads idle and commands are inert no-ops — the footer disc and fader stay sane on the Separate Tab.

**Blocked by:** 01, 02, 03 (every consumer must be snapshot-driven before seeding covers them all).

**Status:** resolved

- [x] Resume seeds `masterVolume` + `playheadSec` from the restored Session's mixer values before the player mounts; footer shows restored values with no default-flash
- [x] Separation completion resets the snapshot to fresh defaults (playing false, playhead 0, volume 1.0, silent levels)
- [x] No-player state: snapshot reads idle, commands are inert no-ops — no crash, no phantom play state
- [x] The snapshot is never a fourth writer of mixer state: persistence keeps its existing single writer (the mixer bridge), auto-save cadence byte-identical
- [x] Session Recovery / resume suite green; `sessionStore` tests green untouched
- [x] Gates green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`

## Comments

- **Resolved 2026-11-06 in commit `057ad88`.**
- Resume: `liveTransportRef.current.seed({ masterVolume, playheadSec })` from the Session's mixer
  payload, ahead of the `setSeparationPhase("completed")` that mounts the player — the first painted
  frame carries the Session's truth (App-seam test: 90% + 00:42 + spine `aria-valuenow="42"` the
  moment the player region appears).
- Reset sites: separation start (`setSeparatedStems(null)` — player unmounts), separation completion,
  new-file decode (`processAudioFile`) and the purge wipe (`handleClearSourceMix`) all
  `release()` + `reset()` — fresh idle defaults land alongside the fresh `initialMixerState`
  (masterVolume 1.0, currentTime 0), and the engine's mount-time mirror is an equal restatement, a
  no-op publish. App-seam test: a fader parked at 40% pre-separation comes back 100%/00:00/idle disc
  after completion.
- No-player: module suite proves idle snapshot + inert commands; App-seam test boots the Separate
  Tab with no engine anywhere — disc click never flips `aria-pressed`, fader paints 40%, zero crashes.
- Single-writer rule intact: nothing in the snapshot path calls `sessionStore`; the mixer bridge and
  auto-save cadence are byte-untouched (sessionStore suite green in all four gate runs).
