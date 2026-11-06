# 02: Session Recovery Lifecycle & Storage State Machine

**What to build:** An integrated recovery and persistence state machine within `SessionManager` that orchestrates startup session detection, lazy hydration, and complete session purge operations. The manager manages lifecycle transitions across `idle`, `detected`, `resuming`, `active`, and `error` states. When the application starts up, `checkPrevious` inspects storage and exposes detected session metadata on the snapshot without loading full audio channel arrays into memory. When the user chooses to resume, `resume` hydrates the raw channel buffers into the active session slot and updates status to `active`. When discarding or purging, `purge` cancels pending debounced writes, resets memory state, and deletes stored records from IndexedDB and OPFS, resetting status to `idle`.

**Blocked by:** 01: The Headless Session Manager Core & Reactive Seam.

**Status:** resolved

- [x] `checkPrevious` queries storage for existing sessions; if found, transitions status to `detected` and populates `snapshot.detectedMetadata` with lightweight metadata without loading heavy audio buffers.
- [x] If no previous session exists or storage is empty, `checkPrevious` leaves status at `idle` with `detectedMetadata: null`.
- [x] `resume` loads and deserializes full audio channel arrays from storage, sets status to `active`, populates `snapshot.session`, and resolves with the hydrated `DemuxifySession`.
- [x] Corrupted, truncated, or incomplete storage records during `checkPrevious` or `resume` are handled gracefully, resetting state or emitting an informative error snapshot without throwing unhandled exceptions.
- [x] `purge` cancels any pending debounced timers, wipes active in-memory session state, deletes database and OPFS entries via storage adapter, and transitions status to `idle`.
- [x] Headless unit tests in `src/__tests__/sessionManager.test.ts` verify full recovery state transitions (`idle` -> `detected` -> `resuming` -> `active`), purge wipe guarantees, and resilience against corrupted storage records.

## Answer

Implemented full recovery lifecycle state machine (`idle` -> `detected` -> `resuming` -> `active`, plus `error`) inside `SessionManager`. Added `loadActiveSessionMetadata` to `sessionStore.ts` for buffer-free metadata detection during startup. Verified with unit tests in `sessionManager.test.ts` and `sessionStore.test.ts`.
