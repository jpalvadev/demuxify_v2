# 03: App Shell Integration & InferenceClient Retirement

**What to build:** Integration of the headless `SeparationEngine` into the root application shell (`App.tsx`), eliminating loose state variables, manual channel slicing loops, and direct Web Worker management. When the user starts separation, the component triggers the engine via `separateAudio` with an internal `AbortController`, manages cancellation cleanly, hydrates resulting Stems upon completion, and transitions to the Mix Tab. The obsolete shallow wrapper `InferenceClient` is retired and deleted.

**Blocked by:** 01: Separation Engine Core, Worker Message Adapter & Telemetry Seam, 02: Pure View Refactoring of SeparationProgress

**Status:** ready-for-agent

- [ ] `App.tsx` initializes `SeparationEngine` via factory instantiation and calls `dispose()` during component unmount cleanup.
- [ ] Five loose React state variables (`separationPhase`, `downloadProgress`, `chunkProgress`, `chunkStart`, `separationError`) are collapsed into a single atomic `separationState: SeparationUiState` in `App.tsx`.
- [ ] `handleStartSeparation` passes the decoded Source Mix directly to `separationEngine.separate` without manual buffer channel slicing loops.
- [ ] Cancellation is wired through an `AbortController` ref: user cancellation invokes `abortController.abort()`, which cleanly rejects the separation promise with an `AbortError` and resets UI state to `idle`.
- [ ] On completion, `SeparationResult` hydrates the separated Stems, triggers secondary Drum groove analysis if samples exist, seeds initial mixer settings, and creates the Session via `SessionManager`.
- [ ] Manual test-environment checks (`typeof process !== "undefined" && process.env?.NODE_ENV === "test"`) and direct worker management refs are removed from `App.tsx`.
- [ ] The obsolete shallow class `InferenceClient` (`src/lib/inferenceClient.ts`) and its unit test (`src/__tests__/inferenceClient.test.ts`) are deleted and retired.
- [ ] Integration tests in `src/__tests__/App.test.tsx` are updated to mock or spy on `SeparationEngine`, verifying that starting, completing, and cancelling separation functions seamlessly through the root shell.
