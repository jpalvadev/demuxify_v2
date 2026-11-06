# 03: applyClickTrack + setBeatGrid — the Click Track lane reads the snapshot, the re-lock contract survives

**What to build:** The Click Track lane crosses as one command — `applyClickTrack(partial)` taking
`{ enabled?, volume? }` — with the lane's shipped contract intact: inert with no **Beat Grid**, uniform taps
with the lane, volume 0 as its own silence. The **Beat Grid** swap becomes its own verb, `setBeatGrid(grid)`:
the grid is shared stage machinery the lane follows, not Mixer State, so the snapshot carries no grid field;
the swap replaces the clicks' positions in place with mixer settings and Playhead untouched (ticket 06's
re-lock contract, byte-identical). `StemPlayer`'s lane mirror state dies; `onClickTrackState` keeps its byte-
identical lane-state payload, its mount-time initial emit survives (pinned: the lane's first report at
`StemPlayer.test.tsx:612`), and the grid-swap effect's no-change echo disappears — publish-on-change has no
echo to send (if a pinned test depends on a no-change echo, the echo stays and is named here as a deliberate
preservation).

**Blocked by:** 01 (snapshot + subscribe), 02 (verb list settled before lane plumbing lands).

**Status:** resolved

- [x] `applyClickTrack(partial)` on the verb list; lane contract facts (inert-without-grid, uniform taps,
      0 = silence) verified unchanged in the engine suite
- [x] `setBeatGrid(grid)` verb replaces the current grid-replacement path; re-lock keeps mixer + Playhead
      untouched (pinned behavior); `getBeatGrid` leaves the interface at ticket 04's purge
- [x] `StemPlayer`: clickTrack mirror state deleted; lane faces read `snapshot.clickTrack`;
      `onClickTrackState` payload byte-identical, initial emit survives
- [x] Grid-swap echo rule: the effect that restates an unchanged lane state is deleted; pinned-echo
      exceptions named on this ticket if any test demands them
- [x] Retarget roster touched here: engine suite's lane tests onto command+snapshot (the `mobileLightweightEndToEnd`
      suite is already retargeted on 02; re-verify)
- [x] Parity guards green untouched: `StemPlayer.test.tsx` (21 — the lane pins at 576–650 are the guard),
      `App.test.tsx` (60), `sessionStore.test.ts`
- [x] Beat-grid replays NOT required (spec: snap tolerance and ADR-0011 numbers untouched; this is a
      plumbing move — green parity guards are the proof)
- [x] Gates green (full chain, dist rebuilt); zero new ids; no view designed — record: "no new look
      rendered; skin byte-untouched"

## Comments

- (agent, at authoring): Q16 settled the echo rules for this slice. The lane has no mute/solo facts —
  `ClickTrackMixerState` is `{ enabled, volume }` and stays that shape.
- (agent, 2026-11-06, delivered): Engine gains `ClickTrackCommand { enabled?, volume? }` +
  `applyClickTrack` — each written fact publishes through the setters' equality-gated publish, a
  no-change command publishes nothing, and the lane stays inert without a grid exactly as the raw
  setters kept it. `setBeatGrid(grid)` was already the swap verb and stands untouched. The toggle is
  now the UI reading `snapshot().clickTrack.enabled` and sending the flip; the raw setters,
  `toggleClickTrack`, and `getClickTrackState` stay public until ticket 04's purge.
  `StemPlayer`: the lane `useState` mirror died — faces read `snapshot.clickTrack`; the mount effect
  keeps its initial `onClickTrackState` emit (pinned at `StemPlayer.test.tsx:612`) and drops its
  mirror seed; the `[beatGrid]` effect's echo (`setClickTrack` + `onClickTrackState`) is DELETED —
  no pinned test consumes a grid-swap echo (the lane pins assert only `reported[0]` and the
  last-report after a toggle), so the echo-rule exception list is empty. Handler echoes stay
  byte-identical: `{ enabled, volume }` read post-command from `engine.snapshot().clickTrack`.
  Engine suite retarget: all 13 lane calls (8 enable, 2 toggle flips, 5 volume) ride
  `applyClickTrack`; contract pins (node/channel counts, live-playhead re-anchor, 0 = silence,
  clamp, uniform bursts, rate lockstep) unchanged. One new verb-contract pin: equality-gated
  publishes (one fact one publish, no-change = zero, clamp lands in the snapshot). Suite:
  391/391 (390 + 1). Parity guards green with zero retargets; mobileE2E re-verified green.
  Record: "no new look rendered; skin byte-untouched".
