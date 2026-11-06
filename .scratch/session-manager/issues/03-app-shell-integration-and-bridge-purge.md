# 03: App Integration & Shell Refactor (Bridge Purge in App.tsx)

**What to build:** Refactor the application root component (`src/App.tsx`) to subscribe to the headless Session Manager via `useSyncExternalStore`, completely purging mutable refs (`cachedSessionRef`, `autoSaverRef`), loose recovery state variables (`detectedSession`, `isResumingSession`), and six redundant object cloning sites. `App.tsx` dispatches high-level domain commands (`createSession`, `updateMixer`, `attachTempo`, `resume`, `purge`) directly to the Session Manager. The `SessionRecovery` prompt renders directly from snapshot facts and triggers manager commands. The redundant helper `createSessionAutoSaver` in `src/lib/sessionStore.ts` is retired.

**Blocked by:** 01: The Headless Session Manager Core & Reactive Seam, 02: Session Recovery Lifecycle & Storage State Machine.

**Status:** resolved

- [x] `src/App.tsx` initializes `sessionManager` and subscribes to its state via `useSyncExternalStore`, eliminating `cachedSessionRef`, `autoSaverRef`, `detectedSession`, and `isResumingSession`.
- [x] On completion of audio separation, `sessionManager.createSession` is invoked to initialize active session state and trigger auto-save.
- [x] On mixer slider adjustments, `sessionManager.updateMixer` is invoked directly, shedding manual object spreads and manual debouncer calls in `App.tsx`.
- [x] On tempo detection or tap calibration updates, `sessionManager.attachTempo` is invoked directly, delegating candidate re-locking and calibration synchronization to the manager.
- [x] The `SessionRecovery` component renders when `snapshot.status === "detected"` (and no active source mix is present), wiring `onResume` to `sessionManager.resume()` and `onDiscard` to `sessionManager.purge()`.
- [x] `createSessionAutoSaver` in `src/lib/sessionStore.ts` is retired and marked deprecated or deleted.
- [x] All integration tests in `src/__tests__/App.test.tsx` pass cleanly, verifying session detection on mount, recovery hydration into the player, and purge operations through the new Session Manager seam.

## Answer

Refactored `src/App.tsx` to subscribe to the headless `SessionManager` via `useSyncExternalStore`. Completely eliminated `cachedSessionRef`, `autoSaverRef`, `detectedSession`, and `isResumingSession`. All domain mutations (`createSession`, `updateMixer`, `attachTempo`, `resume`, `purge`) dispatch directly to the Session Manager. Marked `createSessionAutoSaver` deprecated. All 57 tests in `src/__tests__/App.test.tsx` passed cleanly.
