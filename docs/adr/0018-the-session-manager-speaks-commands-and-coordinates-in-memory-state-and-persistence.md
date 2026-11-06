# The Session Manager Speaks Commands and Coordinates In-Memory State and Persistence

Extends [ADR-0003](./0003-indexeddb-session-and-shadcn-ui.md) (IndexedDB session persistence), [ADR-0010](./0010-client-side-tempo-detection-and-click-track.md) (Tempo and Beat Grid persistence), [ADR-0012](./0012-solo-and-mute-are-per-stem-exclusive.md) (Solo/mute mutual exclusivity), [ADR-0015](./0015-debug-mode-a-synthetic-session-that-unlocks-every-tab.md) (Synthetic debug session mode), [ADR-0016](./0016-the-player-engine-speaks-commands-and-reports-one-mixer-state.md) (Player Engine commands in, snapshot out), and [ADR-0017](./0017-the-export-engine-speaks-commands-and-renders-one-export-payload.md) (Export Engine commands in, snapshot out).

## Context

Prior to this decision, active session coordination and persistence scheduling were tangled inside the root application shell (`src/App.tsx`). The existing storage utility (`src/lib/sessionStore.ts`) operated merely as a shallow CRUD wrapper around IndexedDB and the Origin Private File System (OPFS), leaving state orchestration, business invariant enforcement, and persistence timing to be manually managed by the UI component:

1. **Mutable Ref Sprawl & Boilerplate**: The root component previously maintained mutable in-memory state in a component ref (`cachedSessionRef`) alongside a manual debouncer ref (`autoSaverRef`). Multiple event handlers across the component performed manual deep-cloning of nested session fields (updating mixer settings, attaching tempo analysis, saving tap calibrations, clearing sessions, resuming sessions, and completing audio separation).
2. **Scattered Invariants**: Business rules—such as mutual exclusivity between solo and mute (ADR-0012), volume range clamping, and the honest supersession of tap calibration upon changing BPM candidates—were fragmented between storage deserialization and loose event handlers rather than enforced at a single entry point.
3. **Leaky Recovery State Machine**: The session recovery flow was previously represented as loose boolean and object states (`detectedSession`, `isResumingSession`) in the root component, requiring manual coordination between storage checks, error handling, and audio buffer reconstruction.
4. **Debug Session Workarounds**: Synthetic debug mode (ADR-0015) required dummy auto-saver objects with no-op functions hardcoded inside the root component to prevent writes to storage.

## Decision

Consolidate active in-memory session state, persistence scheduling, recovery coordination, and domain invariants into a headless, deep **Session Manager** module (`src/lib/sessionManager.ts`) following the "Commands In, Snapshot Out" architecture:

1. **Headless Session Manager Core (`src/lib/sessionManager.ts`):**
   - Presents a clean command interface with domain verbs: `createSession`, `updateMixer`, `attachTempo`, `resume`, `purge`, `flush`, and `dispose`.
   - Exposes reactive session state via `snapshot(): SessionSnapshot` and `subscribe(listener): () => void`, providing reference-stable snapshots compatible with React's `useSyncExternalStore`.
   - Manages the complete recovery and persistence lifecycle state machine (`idle` | `detected` | `resuming` | `active` | `error`).
   - Re-exports canonical domain types (`DemuxifySession`, `SessionMetadata`, `SessionMixerState`, `StemMixerSettings`, etc.) so callers interact solely through the deep manager interface.

2. **Autonomous Persistence & Debouncing:**
   - Encapsulates the debounced auto-save timer internally (`DEFAULT_DEBOUNCE_MS = 600`). Callers emit domain intent via commands without knowing when or how data is written to disk.
   - Immediate persistence can be forced via `flush()`.
   - Cleans up all pending timers and listeners on `dispose()` and `purge()`.

3. **Synchronous Invariant Enforcement:**
   - Validates and enforces business invariants synchronously on every command:
     - ADR-0012 solo/mute mutual exclusivity: solo drops mute; mute drops solo.
     - Volume range clamping: volumes clamped to [0, 1].
     - Honest tempo and calibration synchronization: re-locking candidates honestly supersedes tap calibration.

4. **Buffer-Free Startup Metadata Inspection:**
   - Added `loadActiveSessionMetadata` to `src/lib/sessionStore.ts` allowing startup inspection (`checkPrevious`) to query storage and populate `snapshot.detectedMetadata` with lightweight metadata without loading heavy audio channel buffers.

5. **Quota Resilience & Error Observability:**
   - Storage errors (`StorageQuotaError`) during background auto-saving are captured cleanly and recorded on `snapshot.lastSaveError` without tearing down or corrupting the active in-memory session, allowing uninterrupted playback and export.

6. **Factory Pattern with Storage Mode Injection:**
   - Governed by `createSessionManager(options)` supporting `"storage"` (default) and `"memory-only"` modes.
   - When `persistence: "memory-only"` is configured (as in debug mode or unit tests), all disk reads and writes are safely bypassed natively without UI shims.

7. **Root Shell Simplification in `src/App.tsx`:**
   - Previously maintained `cachedSessionRef`, `autoSaverRef`, `detectedSession`, and `isResumingSession` are deleted and retired from `src/App.tsx`.
   - Retired `createSessionAutoSaver` in `src/lib/sessionStore.ts`.
   - `src/App.tsx` subscribes to the Session Manager via `useSyncExternalStore` and renders `SessionRecovery` directly from snapshot facts.

## Considered Options

- **Keep auto-saver debouncing and mutable session refs in App.tsx** (rejected: causes timing races, component bloat, and prevents headless testing of persistence lifecycle).
- **Couple Session Manager directly to WebAudio AudioContext** (rejected: breaks headless Node/Vitest testability; pure numeric `Float32Array[]` channel arrays keep the manager portable and decoupled from browser audio nodes).
- **Throw unhandled exceptions on storage quota exhaustion** (rejected: browser storage quota limits must never crash active playback sessions or disrupt live mixing).

## Consequences

- Active session state mutations, auto-save debounce cadences, and recovery lifecycle state transitions are tested in milliseconds in pure Node/Vitest (`src/__tests__/sessionManager.test.ts`) using fake timers without mounting React components.
- Component-level integration tests (`src/__tests__/App.test.tsx`) verify that Session Recovery and Mix Tab sliders correctly dispatch commands and display hydrated session facts without ref-based timing races.
- The redundant helper `createSessionAutoSaver` in `src/lib/sessionStore.ts` is retired.
- All pre-commit guardrails (`check:glossary`, `check:doc-anchors`, `check:test-fixtures`, `check:testids`, `check:retired-affordances`, `check:dist-fresh`) pass cleanly.
