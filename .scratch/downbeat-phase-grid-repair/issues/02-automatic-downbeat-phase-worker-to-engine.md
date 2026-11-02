# 02: Automatic Downbeat Phase — worker reading → relay → Click Track synthesis

**What to build:** When the Tempo Detector pass completes, the Beat Grid arrives with an automatic **Downbeat Phase** already picked: the worker scores each candidate phase 0..Meter−1 by low-energy prominence around the beats that land on them and emits its best pick in the complete message; the Stem Player engine's synthesized Click Track then sounds its deeper tone on the beats that are Downbeats under that phase, and its uniform ticks on the rest. On the reference track the deeper tone must land on the beat the anchor's beat set marks as the bar head — never presented as proven.

**Blocked by:** None (can start immediately — but this feature's branch must first land the click-track-tempo base branch, and this ticket's commit also lands the ADR 0011 + `Downbeat`/`Downbeat Phase` glossary paper trail).

**Status:** resolved

- [x] Worker's complete message widens with a Downbeat Phase value in the range 0..Meter−1 (default Meter 4/4); the vocabulary is `downbeatPhase` (glossary: Downbeat Phase), never the raw tracker's naming.
- [x] Automatic reading scores candidate phases over the analyzed channel by low-energy prominence (attack minus quiet approach, 0.12 s window) around landing beats; ties break toward the earlier phase (`pickDownbeatPhase` in `src/lib/beatGridRepair.ts`).
- [x] `synthesizeClickTrackChannel` places the deeper tone where `(beat index − downbeatPhase) mod beatsPerBar === 0`; click positions are identical to the Beat Grid for every phase (engine test asserts rotation moves the deep tone, not the ticks).
- [x] Worker/relay seam pinned: complete message carries the phase (pinned in `beatDetectionWorker.test.ts`), `beatClient.ts` relays it to `TempoAnalysisResult.downbeatPhase` (pinned in `beatClient.test.ts`), the headless fallback path keeps the widened shape (App's StubTempoWorker payload carries it).
- [x] Engine seam pinned: the phase option re-synthesizes the lane (deeper tone at the phase's beats, `getClickTrackDownbeatPhase`/`rotateClickTrackDownbeat`/`setClickTrackDownbeatPhase` accessors); onsets stay put under rotation. (The shared WAV→onsets decode belongs to ticket 06's export seam; the engine seam here decodes buffers directly.)
- [x] Phase pick exercised on the reference-track surrogate: the pulse-lattice surrogate (lattice starting one beat into the grid) yields the deterministic pick 1 at the worker seam; the librosa-anchor verification half lands with ticket 03's tolerance run.
- [x] Nothing presented as proven — this ticket adds no UI; the honesty copy lives on ticket 04's rail.
- [x] Paper trail committed with this ticket: ADR 0011 (`docs/adr/0011-downbeat-reading-and-beat-grid-repair.md`) with the ADR 0010 cross-link, `Downbeat`/`Downbeat Phase` glossary entries; `check:glossary` green.

## Comments

- Design source: ADR 0011 (auto phase + hybrid snap, both user-correctable, never presented as proven).
- No new dependencies; repair of the grid positions is ticket 03 — this ticket changes only the phase value flowing through an otherwise-unchanged complete message.
- Husky-green per commit: typecheck + glossary + full suite inline (no subagents).
- Session-level `downbeatPhase?: number` sibling + read/write gates landed in this commit because App's resume-merge (ticket 04 groundwork on this branch) needs the type to compile; phase is NOT inside SessionTempoState nor ClickTrackMixerState, per the pinned vocabulary.
