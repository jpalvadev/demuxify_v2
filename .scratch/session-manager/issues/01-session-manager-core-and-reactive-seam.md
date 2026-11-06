# 01: The Headless Session Manager Core & Reactive Seam

**What to build:** An autonomous, headless session coordination core (`createSessionManager`) that encapsulates in-memory active session state, equality-gated snapshot publishing (`useSyncExternalStore` compatible), and internal debounced persistence. When mixer or tempo changes are dispatched through high-level domain commands (`createSession`, `updateMixer`, `attachTempo`), the Session Manager synchronously enforces business invariants (ADR-0012 solo/mute exclusivity, volume clamping, and honest supersession of tap calibration upon changing BPM candidates) and schedules debounced storage persistence (600 ms). It provides an in-memory mode for synthetic debug sessions (ADR-0015) and captures storage quota errors cleanly without interrupting the active playback session.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `createSessionManager` accepts configuration options (`persistence: "storage" | "memory-only"`, `debounceMs`, `onSaveError`) and returns a reactive Session Manager instance.
- [x] `snapshot()` returns an equality-gated `SessionSnapshot` (`status`, `session`, `detectedMetadata`, `isSaving`, `lastSaveError`) ensuring reference stability for `useSyncExternalStore`.
- [x] `subscribe(listener)` notifies subscribers whenever the session state transitions or snapshot facts change.
- [x] `createSession` populates the active session in memory and schedules storage persistence.
- [x] `updateMixer` updates mixer levels and Click Track settings while strictly enforcing ADR-0012 mutual exclusivity (solo drops mute, mute drops solo) and volume limits, scheduling a 600 ms debounced save.
- [x] `attachTempo` updates tempo candidates or tap calibration, ensuring re-locking candidates honesty supersedes tap calibration.
- [x] `flush` forces any pending debounced save to persist immediately.
- [x] `dispose` cancels active debouncing timers and disconnects listeners.
- [x] Storage quota or persistence errors are recorded on `snapshot.lastSaveError` without tearing down or corrupting the in-memory active session.
- [x] Headless unit tests in `src/__tests__/sessionManager.test.ts` verify command execution, timer cadences (using `vi.useFakeTimers()`), invariant enforcement, and quota error reporting without DOM or WebAudio dependencies.

## Answer

Implemented `src/lib/sessionManager.ts` providing the headless `createSessionManager` core following the Commands In, Snapshot Out pattern. Covered by 8 headless unit tests in `src/__tests__/sessionManager.test.ts` verifying reactive subscription, ADR-0012 solo/mute mutual exclusivity, volume clamping, honest tempo/calibration supersession, debounced persistence, and non-destructive storage quota error handling.
