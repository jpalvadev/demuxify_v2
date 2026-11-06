# 01: Transport bridge module + scripted adapter — the footer disc runs on the snapshot

**What to build:** The **Transport** bridge module exists at the shell seam with its full interface — one snapshot read side, four commands — and its first live consumer is the footer's coral disc: pressing it plays/pauses through the module's commands, its icon and `aria-pressed` read the snapshot's `playing`, the end-of-track stop flips it back, and Space keeps toggling with its text-field guard. The mutable transport ref assigned mid-render is deleted, the play-state mirror state is deleted, and the module's behavior suite crosses commands→snapshots through the scripted adapter with no audio machinery. The **Stem Player**'s interface (bridge handoff, all five channels) is untouched — the live adapter consumes it as-is.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Module interface is `subscribe(listener) → unsubscribe` + `getSnapshot()` returning `{ playing, playheadSec, masterVolume, levels }` (prototype-derived shape, from the spec) plus the four commands `play · pause · seek(seekSec) · setMasterVolume(volume)`
- [x] Snapshot reference is stable between changes (`useSyncExternalStore` semantics) — equal snapshots never re-render readers
- [x] Scripted adapter (test-side, lives in the tests' mock home per the mock-separation rule) records commands and pushes scripted snapshots — it is the second adapter at the seam
- [x] Behavior suite at the module seam, external behavior only: play flips `playing`; a scripted end-of-track stop flips `playing` back; `seek` lands `playheadSec`; `setMasterVolume` lands `masterVolume`; a scripted level sample flows through coalesced, unmangled; unwired snapshot reads idle and commands are inert no-ops
- [x] Live adapter wires the **Stem Player**'s bridge handoff (the transport-controls moment) + play-state channel into the snapshot; the player's props and channel meanings are byte-unchanged
- [x] Footer disc reads `playing` from the snapshot; the disc's "dispatch play or pause by state" decision stays UI-side over the module's commands
- [x] Mutable transport ref (assigned mid-render) deleted; the footer play-state mirror state deleted
- [x] Space toggle keeps working as the fallback transport channel, guard intact
- [x] The App-seam disc tests that swapped `window.AudioContext` classes are retargeted to the scripted adapter
- [x] Volume/levels/playhead surfaces keep their existing mirror wiring untouched — this ticket rewires the disc only; all gates stay green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`

## Comments

- **Resolved 2026-11-06 in commit `1726ade` (stitch-style combined landing `transport-snapshot 01+02`
  — 01 and 02 interleave in App.tsx/App.test.tsx and shared one commit).** Module:
  `src/lib/transportBridge.ts`; scripted adapter: `src/__tests__/scriptedTransportAdapter.ts`;
  behavior suite: `src/__tests__/transportBridge.test.ts` (10 tests, zero audio machinery).
- Disc retarget nuance: the ADR-0013 live-mirror disc test (`App.test.tsx`, LiveAudioContext +
  rAF pump) **survives verbatim** — per the spec it is the live adapter's proof that the Playhead
  rides the position channel; the scripted-adapter coverage the ticket asked for landed as the NEW
  scripted disc test ("drives the footer disc on the Transport snapshot"). The class-swap test that
  faked shell facts outright (the peak-pips MeterAudioContext swap) was retired — on ticket 02's
  retarget, same commit.
- Footer fader/%/pips mirror states (`footerMasterVolume`, `footerPeakLevels`) deleted in the same
  landing — ticket 02's bullets are resolved on its own file.
