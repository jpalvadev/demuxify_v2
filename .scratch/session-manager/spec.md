# Spec: Session Manager — Deepen Session Management behind an In-Memory Session Core

Status: ready-for-agent

Recorded on the tracker 2026-11-06. This is the architectural deepening increment for Candidate 2 of the 2026-11-06 architecture review: consolidating active in-memory session state, persistence coordination, auto-save debouncing, and recovery lifecycle management into a deep **Session Manager** module. The user affordances, storage schemas, recovery prompts, and persistence guarantees remain invariant. Glossary terms used throughout: **Session**, **Session Manager**, **Source Mix**, **Stems**, **Stem Player**, **Player Engine**, **Export Engine**, **Tab Shell**, **Tab**, **Rail**, **Click Track**, **Beat Grid**, **Time-Stretch**, **Pitch-Shift**, **Formant Preservation**, **Playhead**.

## Problem Statement

Currently, session persistence and active session state coordination are tangled inside the root application shell (`App.tsx`). The existing storage utility (`sessionStore.ts`) operates merely as a shallow CRUD wrapper around IndexedDB and the Origin Private File System (OPFS), leaving the higher-level state orchestration, mutation logic, and persistence timing to be manually managed by the UI component:

1. **Mutable Ref Races & Boilerplate**: The root component maintains mutable in-memory state in a component ref (`cachedSessionRef`) alongside a manual debouncer ref (`autoSaverRef`). Six different event handlers across the component perform manual deep-cloning of nested session fields (updating mixer settings, attaching tempo analysis, saving tap calibrations, clearing sessions, resuming sessions, and completing audio separation).
2. **Scattered Invariants**: Business rules and sanitization—such as mutual exclusivity between solo and mute, volume range clamping, and the honest supersession of tap calibration when changing BPM candidates—are fragmented between storage deserialization and loose event handlers rather than enforced at a single entry point.
3. **Leaky Recovery State Machine**: The session recovery flow is represented as loose boolean and object states (`detectedSession`, `isResumingSession`) in the root component, requiring manual coordination between storage checks, error handling, and audio buffer reconstruction.
4. **Fragile Testing**: Testing auto-save behavior or session lifecycle edge cases currently requires mounting the complete React component tree or manipulating shallow storage helper functions directly, bypassing in-memory session invariants.
5. **Debug Session Workarounds**: The synthetic debug session mode (ADR-0015) requires dummy auto-saver objects with no-op functions hardcoded inside the root component to prevent writes to storage.

## Solution

Consolidate active in-memory session state, persistence scheduling, recovery coordination, and domain invariants into a headless, deep **Session Manager** module following the "Commands In, Snapshot Out" architecture:

1. **Headless Session Manager Core**:
   - Presents a clean command interface with domain verbs: `createSession`, `updateMixer`, `attachTempo`, `resume`, `purge`, `flush`, and `dispose`.
   - Exposes reactive session state via `snapshot(): SessionSnapshot` and `subscribe(listener): () => void`, providing reference-stable snapshots compatible with React's `useSyncExternalStore`.
   - Manages the complete recovery and persistence lifecycle state machine (`idle` | `detected` | `resuming` | `active` | `error`).
2. **Autonomous Persistence & Debouncing**:
   - Encapsulates the 600 ms auto-save debouncer internally. Callers emit domain intent via commands without knowing when or how data is written to disk.
   - Manages graceful storage error handling and quota exhaustion (`StorageQuotaError`) without crashing the active in-memory session, exposing errors through `lastSaveError` on the snapshot.
3. **Synchronous Invariant Enforcement**:
   - Validates and enforces business invariants synchronously on every command: ADR-0012 solo/mute mutual exclusivity, volume clamping, and tempo/calibration synchronization.
4. **Pure Data Headless Boundary**:
   - Operates strictly on serializable numeric channel arrays (`Float32Array[]`), remaining entirely decoupled from WebAudio and `AudioContext`.
   - Audio buffer conversions remain in pure utility functions at the playback boundary.
5. **Configurable Storage Modes & Factory Pattern**:
   - Instantiated via a factory function supporting `"storage"` (IndexedDB/OPFS) and `"memory-only"` modes, natively supporting ADR-0015 synthetic debug sessions without UI shims.
6. **Root Shell Simplification**:
   - The root component sheds `cachedSessionRef`, `autoSaverRef`, `detectedSession`, `isResumingSession`, and manual object spreads, reducing component size and eliminating ref-based timing races.

## User Stories

1. As a music producer using Demuxify Web, I want my active mixer settings (volumes, mutes, solos, pitch, and tempo) to be automatically saved after I adjust them, so that I never lose my mix adjustments if my browser reloads.
2. As a music producer, I want adjusting mixer controls rapidly to debounce auto-saving to 600 ms, so that my browser does not stutter or overload storage transactions while moving sliders.
3. As a music producer, I want my active session to immediately remember my selected BPM candidate or tap-calibrated Beat Grid, so that my metronome and click settings persist seamlessly across sessions.
4. As a returning user, I want the application to detect my previously saved session on startup and prompt me to resume or discard it, so that I can easily pick up where I left off.
5. As a returning user, I want clicking 'Resume' on a detected session to hydrate my separated stems, mixer settings, and tempo settings accurately, so that my mix sounds identical to how I left it.
6. As a user starting fresh, I want clicking 'Discard' on a previous session to cleanly purge both memory and browser storage (IndexedDB and OPFS), so that no residual audio data occupies my device storage.
7. As a user on a storage-constrained mobile device, I want storage quota errors during auto-saving to be captured cleanly without crashing my current playback session, so that I can continue listening and exporting without abrupt interruptions.
8. As a developer debugging new features with the debug flag, I want the synthetic debug session to operate purely in memory without persisting to storage, so that debug sessions never corrupt my real saved session.
9. As an audio engineer, I want soloing a stem to automatically clear mute, and muting a stem to automatically clear solo, so that my session state always obeys audio mixing exclusivity invariants.
10. As a developer maintaining the codebase, I want session state mutations and auto-save timing to be testable in headless Node/Vitest suites without mounting React components, so that test execution is fast and deterministic.
11. As a developer navigating the codebase, I want the session subsystem to speak explicit domain verbs (`createSession`, `updateMixer`, `attachTempo`, `resume`, `purge`), so that the intent of every session mutation is immediately clear.
12. As a user navigating between tool tabs, I want the session state to remain stable and reactive via external store subscription, so that tab switching introduces no state tearing or UI lag.

## Implementation Decisions

### Decision 1: Formal Domain Entity and Seam Identity

- Establish **Session Manager** in the domain glossary as the headless coordinator owning active session state, persistence scheduling, and recovery lifecycle.
- Keep the existing storage module as a private, low-level persistence adapter for raw IndexedDB and OPFS transactions.
- Re-export canonical domain types (`DemuxifySession`, `SessionMetadata`, `SessionMixerState`, `StemMixerSettings`, etc.) from the Session Manager module so callers only interact with the deep manager interface.

### Decision 2: Reactive "Commands In, Snapshot Out" Pattern

- Expose a reference-stable snapshot interface:
  ```ts
  type SessionLifecycleStatus =
    "idle" | "detected" | "resuming" | "active" | "error";

  interface SessionSnapshot {
    status: SessionLifecycleStatus;
    session: DemuxifySession | null;
    detectedMetadata: SessionMetadata | null;
    isSaving: boolean;
    lastSaveError: Error | null;
  }
  ```
- Equality-gated updates: `snapshot()` returns the identical object reference if no state facts have changed, enabling zero-tearing rendering with React's `useSyncExternalStore`.
- Subscription seam: `subscribe(listener: (snapshot: SessionSnapshot) => void): () => void`.

### Decision 3: Expressive Domain Command Seam

The public command interface is restricted to high-level domain operations:

- `createSession(params: CreateSessionParams): Promise<void>`: Initializes active session after separation and triggers auto-save.
- `updateMixer(mixerUpdate: Partial<SessionMixerState>, clickTrack?: ClickTrackMixerState): void`: Enforces ADR-0012 invariants and schedules debounced save.
- `attachTempo(tempo: SessionTempoState, calibration?: SessionClickCalibration | null): void`: Attaches tempo detection or tap calibration, synchronizing supersessions.
- `resume(): Promise<DemuxifySession>`: Hydrates the detected session into memory and updates status to `active`.
- `purge(): Promise<void>`: Cancels pending timers, wipes active memory, and clears browser storage.
- `flush(): Promise<void>`: Immediately flushes any pending debounced save to storage.
- `dispose(): void`: Tears down all timers and external listeners.

### Decision 4: Autonomous Persistence & Quota Observability

- Debounce scheduling (default 600 ms) is completely internal and self-managing.
- If storage quota is exceeded or an IndexedDB write fails, the error is recorded on `snapshot.lastSaveError` and passed to an optional `onSaveError` callback, leaving the in-memory active session intact and functional.

### Decision 5: Headless Core Independent of WebAudio

- The Session Manager operates exclusively on serializable channel data (`Float32Array[]`) and never imports or references `AudioContext` or WebAudio nodes.
- AudioBuffer conversions remain strictly in pure utility functions at the playback/view boundary.

### Decision 6: Factory Pattern with Storage Mode Injection

- Instantiation is governed by `createSessionManager(options?: SessionManagerOptions)`:
  ```ts
  interface SessionManagerOptions {
    persistence?: "storage" | "memory-only";
    debounceMs?: number;
    onSaveError?: (error: unknown) => void;
  }
  ```
- When `persistence: "memory-only"` is configured (as in debug mode or unit tests), all disk reads and writes are safely bypassed.

### Decision 7: Elimination of Root Component State Plumbing

- `App.tsx` drops `cachedSessionRef`, `autoSaverRef`, `detectedSession`, and `isResumingSession`.
- `SessionRecovery` receives its metadata and action callbacks directly derived from the `SessionSnapshot`.

## Testing Decisions

- **Good Test Philosophy**: Tests must exercise the external domain command seam and assert observable snapshot changes and storage outcomes, without mocking or asserting private timer implementations or internal ref state.
- **Primary Seam**: Headless unit test suite exercising `SessionManager` directly using Vitest fake timers (`vi.useFakeTimers()`) to verify:
  1. Debounced persistence cadence (600 ms).
  2. Immediate save execution on `flush()`.
  3. Immediate cancellation and cleanup on `purge()` and `dispose()`.
  4. Invariant enforcement (ADR-0012 solo/mute mutual exclusivity, volume ranges).
  5. Tempo candidate re-locking and tap calibration supersession.
  6. Recovery state machine transitions (`idle` -> `detected` -> `resuming` -> `active`).
  7. Storage quota error handling and `lastSaveError` reporting.
  8. Memory-only mode for synthetic debug sessions.
- **Secondary Seam**: Component-level integration tests (`App.test.tsx`) asserting that the Tab Shell, Session Recovery prompts, and Mix Tab sliders correctly dispatch commands and display hydrated session facts.
- **Prior Art**: The command-and-snapshot test patterns established for Player Engine (`src/__tests__/stemPlayerEngine.test.ts`) and Export Engine (`src/__tests__/exportEngine.test.ts`).

## Out of Scope

- Changes to the underlying IndexedDB or OPFS binary storage format or database schema.
- UI redesign or visual changes to the `SessionRecovery` prompt or Tab Shell layout.
- Modifications to the Player Engine playback graph or audio processing nodes.
- Multi-session management or cloud project synchronization (Demuxify Web maintains a single active local session per ADR-0003).

## Further Notes

- Retiring `createSessionAutoSaver` in the low-level storage module avoids duplicated debouncing logic.
- All code identifiers and file paths adhere to `CODING_STANDARDS.md`, `check:glossary`, and `check:doc-anchors`.
- An architectural decision record (**ADR-0018**) will accompany the implementation to document this structural deepening.
