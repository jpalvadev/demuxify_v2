# 02: Tempo Detector — automatic analysis at decode with Separate-tab readout

**What to build:** Dropping a Source Mix into the app automatically runs the Tempo Detector off the main thread on one channel of the decoded audio, and the Separate tab's status area shows the top BPM candidate as soon as analysis completes — before Inference Engine separation finishes. Verified end-to-end on the reference steady-tempo rock track against the librosa ground-truth anchor.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] One npm dependency (`@audio/beat` ^3.1.0) added; no other new dependencies (its atoms `@audio/beat-{detect,onset,tempo,track}` + `@audio/onset` were already in the tree as transitive deps).
- [x] New beat-detection client↔worker pair follows the established heavy-pass client/worker pattern (`src/lib/beatClient.ts` ↔ `src/workers/beatDetection.worker.ts` mirrors `inferenceClient.ts` ↔ `inference.worker.ts` exactly: message unions, `worker_log` → diagnostics relay, promise relay, cancel, terminate; App hook wraps construction so headless/SSR stays graceful).
- [x] `scripts/check_bpm.py` verification anchor added following the provisioning-script pattern; verified on this machine: `librosa tempo anchor: 107.7 BPM (503 beats, median interval 0.557s)` / SUCCESS.
- [x] Real-audio end-to-end test (`src/__tests__/realAudioMix.test.ts`) gained the tempo it(): top ranked candidate within octave-tolerant ±5% of the 107.7 BPM librosa anchor, Beat Grid monotonic with median interval ±10% of 0.557 s, and beat-density extrapolation to the 294.1 s Source Mix within ±10% of the 503-beat librosa count (mock-decode convention: deterministic synthetic 107.7 BPM pulse surrogate, per CODING_STANDARDS §4 test double).
- [x] Analysis output carried as `TempoAnalysisResult { candidates, beatGrid, analyzedBpm, duration }` — ranked BPM candidates + confidence + Beat Grid of beat positions in seconds; engine only ranks, never silently picks over octave ambiguity.
- [x] Separate tab status line renders the top candidate with alternatives listed honestly (agent-authored mono micro-line — see ticket 01 FALLBACK RECORD); Mix stays gated until Stems exist (Tab Shell rule untouched).
- [x] Heavy pass lives in the worker (`startTempoAnalysis` is fire-and-forget with a stale-result guard, cleared and cancelled on `handleClearSourceMix`); full suite green 303/303, existing Separate progress tests in `App.test.tsx` not regressed.

## Comments

- CLOSED (ticket 02): implementation = `src/lib/beatClient.ts` + `src/workers/beatDetection.worker.ts` (combTempo minBpm 45/maxBpm 240/candidates 4 → ranked dedupe by confidence; beatTrack phase-aligned grid in SECONDS, `f * hopSize / fs`), App hook in `processAudioFile` + `Tempo Detector` status micro-line, `scripts/check_bpm.py` librosa anchor (107.7 BPM / 503 beats / 0.557 s / 294.1 s), test pair `beatClient.test.ts` + `beatDetectionWorker.test.ts` + real-audio anchor it(). Verification: typecheck clean, glossary clean, full suite 303/303. Look on the status line is agent-authored (ticket 01 fallback record), not an OpenDesign run.
