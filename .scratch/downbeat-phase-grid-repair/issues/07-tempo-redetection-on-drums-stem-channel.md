# 07: Drums Stem re-detection — the Beat Grid re-read where the groove is isolated

**What to build:** Once Separation completes, the Tempo Detector re-runs its single heavy-pass machinery over the Drums Stem's merged channel instead of the Source Mix channel: the percussive pulse lives there without vocal/bass interference, and the measured Source Mix tail slips (210–294 s: 54/170 clicks >80 ms from any librosa strong onset, identical on the RAW grid) are detection-quality defects of the FED channel, not of repair (ADR-0011 Amendment). With no usable Drums samples the decode-time Source Mix reading stays the grid (fallback, not gap). No new UI, no new worker code path — the worker already consumes any `Float32Array` channel (ticket 06's re-lock hint proved the machinery reusable); the policy point is which channel feeds it.

**Blocked by:** 06 (re-lock machinery reusing the same pass) — and ADR-0011 Amendment, which located the tail damage in detection, not repair.

**Status:** resolved

- [x] Separation completion posts a second detection pass over the merged Drums channel. — Test "re-detects the Beat Grid on the Drums Stem channel once Separation completes": stub records every start message; two passes posted (500-frame Source Mix at decode, 700-frame merged Drums after separation), both unhinted; rail readout survives both completions.
- [x] Fallback: a Drums Stem with no samples posts no stem pass at all and the Source Mix grid stays on the rail. — Test "keeps the Source Mix Beat Grid when the Drums Stem carries no samples (fallback)": `drums: []` mock → exactly one pass posted, readout delivered from it.
- [x] One-pass-at-a-time honored: a Source Mix pass still in flight at Separation completion is cancelled by its own groove-channel successor; the abandoned reading is discarded, never resurrected. — Existing stale-result guard (`beatClientRef.current === client`) plus explicit cancel in the hook; both queued replies still leave the rail coherent (App.test.tsx 47/47).
- [x] Re-lock and Session-recovery passes feed the same policy: Drums channel when available (re-lock reads the live stems state; recovery hands the Session's stems explicitly), Source Mix otherwise. — Same `channelForTempoAnalysis` entry point; re-detection call sites pass stems explicitly where the same-tick state read would be stale (decode passes explicit `null` so a previous track's stems cannot leak in).
- [x] Full suite + typecheck + glossary green on the commit (355/355, 40 files).

## Comments

- Port record (agent): `src/App.tsx` gains `channelForTempoAnalysis(buffer, stems)` (channel-averaged `Float32Array` merge of the Drums Stem, Source Mix channel 0 as fallback) and `startTempoAnalysis` grows a third parameter for same-tick call sites; the Separation-completion hook cancels an in-flight pass and re-arms `startTempoAnalysis` with the fresh stems. Worker, engine, export: untouched.
- Honest boundary recorded in ADR-0010 Amendment: the reference track's stem-channel tail could not be re-measured on this machine (no isolated stems on disk; separation is client-side only). The claim shipped is that the tail defect is channel-level; the A/B lands on the user's own material in the app.
- If the stem pass FAILS (silent Drums channel, no plausible BPM), its non-fatal catch leaves the Source Mix reading in place — the grid never vanishes mid-analysis.
