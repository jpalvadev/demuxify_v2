# 03: Tempo Analysis persisted in the Session

**What to build:** A recovered Session resumes with the same Tempo Detector result: the ranked candidates, the user-chosen tempo, and the Beat Grid survive the session store round-trip and Session Recovery, so the tempo readout is identical after reload/recovery.

**Blocked by:** 02 (Tempo Detector — automatic analysis at decode with Separate-tab readout).

**Status:** closed

- [x] Session metadata gains the Tempo Analysis state (`SessionTempoState { candidates, chosenTempoBpm?, beatGrid: Float64Array, analyzedBpm, duration }` as optional `tempo?` on `DemuxifySession` + `StoredSessionRecord` in `src/lib/sessionStore.ts`; `TempoCandidate` imported type-only from the worker so no runtime coupling; the four `StemName` identities and `SessionMixerState` untouched).
- [x] Existing session-store test seam extended (`sessionStore.test.ts` round-trip it()): save → reload returns identical ranked candidates (`toEqual` element-wise), chosen tempo, and Beat Grid (Float64Array element-wise equality).
- [x] Session Recovery test pair extended (`App.test.tsx` new resume it()): a seeded Session carrying tempo state resumes with the exact same Separate-tab Tempo readout (`Tempo Detector: 107.7 BPM | alternatives 215.4 BPM`, Tab Shell keeps the inactive panel in the DOM).
- [x] Auto-save debounce and quota behavior unchanged — existing debounce + `StorageQuotaError` it()s green untouched; Beat Grid is a single typed array through the same structured-clone path.
- [x] Older sessions written before this feature still load (new it(): legacy Session without tempo loads with `tempo` undefined; App resume re-runs `startTempoAnalysis` on the restored buffer when `session.tempo` is absent).

## Comments

- CLOSED (ticket 03): implementation = `SessionTempoState` + optional `tempo` on both Session shapes in `src/lib/sessionStore.ts` (save maps candidates, shares beatGrid ref — IDB structured-clone copies; load `record.tempo ?? undefined`), App.tsx persistence wiring (`tempoResultRef` caches the completed analysis, `sessionToSave.tempo`, resume restores `session.tempo` with re-analyze fallback, refs nulled on both reset paths), tests = sessionStore round-trip extension + legacy-load it() + App resume readout it(). Verification: typecheck clean, glossary clean, full suite 305/305. No new look rendered — readout is the ticket-01/02 agent-authored mono micro-line.
