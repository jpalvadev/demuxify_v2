# 01: StemPlayerSnapshot + subscribe + mixer verbs — the four Stem Strips read the snapshot

**What to build:** The **Player Engine** grows its read side and its mixer command: one `StemPlayerSnapshot`
(`playing, playheadSec, duration, masterVolume, stems, clickTrack, timeStretch, levels, stretchMode`) read
through one `subscribe(listener) → unsubscribe` with `useSyncExternalStore` semantics, published only on real
change, and `applyMixer(partial)` carrying per-Stem volume/mute/solo plus Master volume, with ADR-0012's
per-Stem exclusivity resolved inside the command. The first consumer is the **Stem Player**'s mixer side: the
four **Stem Strips** and the Master fader read the snapshot, the per-Stem mixer mirror state and the Master
volume mirror state die, the "set, re-get, re-emit" triplet collapses to one command plus one echo, and the
mixer-and-Session bridge keeps its exact payload shape, fed only by mixer-fact transitions. Every other
mirror, verb pair, and getter stays exactly as shipped — this slice moves the mixer facts only.

**Blocked by:** None (can start immediately). Branch `engine-command-surface`, off `transport-snapshot`.

**Status:** resolved

- [x] `StemPlayerSnapshot` exported from the engine module with the spec's shape; sub-objects cloned at
      publish; an equal snapshot never publishes and never mints a new object (equality-gated publish,
      `transportBridge.ts`'s `snapshotEquals` is the model)
- [x] `subscribe(listener) → unsubscribe` is the engine's one read channel; `snapshot()` is the sync read;
      the snapshot carries no beatGrid field and no derived flags
- [x] `applyMixer(partial)` applies per-Stem `{ volume?, muted?, solo? }` and `masterVolume?`; solo/mute
      exclusivity (ADR-0012) resolves inside the command where the gain matrix already enforces it;
      `setStemSolo`/`setStemMute` survive as **private** methods so ADR-0012's citation stays live in
      shipped code
- [x] No toggle verbs added anywhere; the UI derives the next press from the snapshot (`hasAnySolo`,
      `isSilenced` stay UI-side arithmetic on `snapshot.stems`)
- [x] `StemPlayer` reads the snapshot via `useSyncExternalStore` for the mixer facts; `mixerStates` and
      `masterVolume` mirror states deleted; post-command `get…()` re-reads deleted on the mixer path
- [x] `onMixerChange` keeps byte-identical `{ stems, masterVolume, currentTime }` payloads and cadence —
      it fires on mixer-fact transitions only, never on playhead/levels transitions (ADR-0013, persistence
      single writer); the mount-time initial emit survives (pinned path, `StemPlayer.test.tsx`)
- [x] The Transport bridge's `setMasterVolume` verb maps onto `applyMixer` — bridge module and shell
      wiring byte-unchanged (scope rule)
- [x] Stem Strip press sequences keep measuring gain outcomes on **live gain nodes** through the existing
      mock AudioContext observicals (`mockCtx.createdGains`) — same numbers, byte-identical
- [x] Engine behavior: new suite coverage crossing `applyMixer` in / snapshot out at the engine seam; the
      engine suite's mixer getter/setter tests retargeted onto the command + snapshot as they are touched
- [x] Parity guards green untouched: `StemPlayer.test.tsx` (21), `App.test.tsx` (60),
      `transportBridge.test.ts` (11), `sessionStore.test.ts`, `StemStrip.test.tsx`
- [x] Gates green: typecheck, full suite via `test:report`, `check:testids` (zero new ids),
      `check:retired-affordances`, `check:doc-anchors`, `check:glossary`, `check:dist-fresh` (dist rebuilt)
- [x] No new seam, no new mock dialect; no view designed — record on this ticket: "no new look rendered;
      skin byte-untouched, ADR-0014 contract respected"

## Comments

- (agent, at authoring): Grilling settled Q13 (snapshot shape verbatim) and Q6 (exclusivity + private
  enforcement names) for this slice. Anchoring rule: `npm run outline src/lib/stemPlayerEngine.ts` before
  every edit (1400-line file).
- (agent, 2026-11-06, resolved): Landed on `engine-command-surface`. `StemPlayerSnapshot` +
  `SnapshotListener` + `MixerCommand` exported; `stemPlayerSnapshotsEqual`/`stemMixerStatesEqual` gate
  publish (transportBridge's `snapshotEquals` model — equal snapshot never publishes, never mints);
  `subscribe()` delivers the current snapshot on attach; `snapshot()` is reference-stable; all publish
  sites wired (position/state/timeStretch/levels notify, master volume, click-lane, worklet handoffs,
  dispose). `MixerCommand` is keyed by `StemName` (`stems: { vocals: { volume? , muted?, solo? } }`)
  mirroring the snapshot's `stems` shape, with `masterVolume?` — no `stemId` indirection. Publishes are
  setter-driven and equality-gated: a command changing one fact publishes exactly once, a no-change
  command publishes zero (pinned in `stemPlayerEngine.test.ts`, 8 new seam tests, suite 50/50).
  `setStemMute`/`setStemSolo` stay public as shipped surface until ticket 04's purge retires the public
  setter pairs — they become the private enforcement names (ADR-0012 citation) in ticket 04;
  `toggleStemMute`/`toggleStemSolo` die there too. `handleSeek`'s onMixerChange echo is deliberately
  preserved with the raw `currentTime: seekTime` (Session persistence rides that beat). The Transport
  bridge and shell wiring are byte-unchanged; `transportBridge.test.ts` (11) and all parity guards
  green with zero retargets. Full suite 390/390 (382 + 8 new pins), `dist/` rebuilt.
  Record: **no new look rendered; skin byte-untouched, ADR-0014 contract respected** (no OpenDesign
  run — no view designed).
