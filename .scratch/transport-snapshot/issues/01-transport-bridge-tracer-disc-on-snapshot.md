# 01: Transport bridge module + scripted adapter — the footer disc runs on the snapshot

**What to build:** The **Transport** bridge module exists at the shell seam with its full interface — one snapshot read side, four commands — and its first live consumer is the footer's coral disc: pressing it plays/pauses through the module's commands, its icon and `aria-pressed` read the snapshot's `playing`, the end-of-track stop flips it back, and Space keeps toggling with its text-field guard. The mutable transport ref assigned mid-render is deleted, the play-state mirror state is deleted, and the module's behavior suite crosses commands→snapshots through the scripted adapter with no audio machinery. The **Stem Player**'s interface (bridge handoff, all five channels) is untouched — the live adapter consumes it as-is.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Module interface is `subscribe(listener) → unsubscribe` + `getSnapshot()` returning `{ playing, playheadSec, masterVolume, levels }` (prototype-derived shape, from the spec) plus the four commands `play · pause · seek(seekSec) · setMasterVolume(volume)`
- [ ] Snapshot reference is stable between changes (`useSyncExternalStore` semantics) — equal snapshots never re-render readers
- [ ] Scripted adapter (test-side, lives in the tests' mock home per the mock-separation rule) records commands and pushes scripted snapshots — it is the second adapter at the seam
- [ ] Behavior suite at the module seam, external behavior only: play flips `playing`; a scripted end-of-track stop flips `playing` back; `seek` lands `playheadSec`; `setMasterVolume` lands `masterVolume`; a scripted level sample flows through coalesced, unmangled; unwired snapshot reads idle and commands are inert no-ops
- [ ] Live adapter wires the **Stem Player**'s bridge handoff (the transport-controls moment) + play-state channel into the snapshot; the player's props and channel meanings are byte-unchanged
- [ ] Footer disc reads `playing` from the snapshot; the disc's "dispatch play or pause by state" decision stays UI-side over the module's commands
- [ ] Mutable transport ref (assigned mid-render) deleted; the footer play-state mirror state deleted
- [ ] Space toggle keeps working as the fallback transport channel, guard intact
- [ ] The App-seam disc tests that swapped `window.AudioContext` classes are retargeted to the scripted adapter
- [ ] Volume/levels/playhead surfaces keep their existing mirror wiring untouched — this ticket rewires the disc only; all gates stay green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`

## Comments
