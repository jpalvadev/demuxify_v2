# 01: Separation Engine Core, Worker Message Adapter & Telemetry Seam

**What to build:** An autonomous, headless neural network separation core (`createSeparationEngine`) that accepts a Source Mix and model configuration, managing the complete execution lifecycle behind a promise-based seam (`separate`). It handles worker pool creation and persistence across runs with matching Model Profiles, performs polymorphic channel slicing from audio inputs, converts worker events into a strongly-typed `SeparationProgressEvent` stream (`downloading`, `initializing`, `separating`), halts processing cleanly upon receiving a standard Web API `AbortSignal` (rejecting with `AbortError`), maps worker failures into structured domain errors (`SeparationError`), and deterministically releases worker resources on `dispose()`.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `createSeparationEngine` accepts configuration options (`useMock`, `workerFactory`) and returns a persistent Separation Engine instance.
- [x] `separate` accepts `SeparationRequest` (`source: AudioBuffer | { channels: Float32Array[]; sampleRate: number }`, `modelProfileId`, `preferredBackend`) and returns a `Promise<SeparationResult>`.
- [x] Multi-channel audio extraction is handled internally, allowing callers to pass either an `AudioBuffer` or raw numeric channel arrays without manual slicing loops.
- [x] The engine reuses the active Web Worker and compiled session across consecutive separations when the same Model Profile is reused, re-initializing only when the profile changes.
- [x] Progress events are emitted via `options.onProgress` as a strongly-typed discriminated union: `downloading` (with loaded/total bytes), `initializing` (with backend identity), and `separating` (with chunk index, total chunks, elapsed time, and ETA).
- [x] Cancellation is governed via standard `options.signal` (`AbortSignal`): aborting mid-flight posts `{ type: "cancel" }` to the worker, detaches listeners, and rejects the promise with a standard `AbortError` (DOMException).
- [x] Worker errors and memory exhaustion crashes are mapped to typed `SeparationError` instances with machine-readable error codes (`OOM`, `BACKEND_UNAVAILABLE`, `MODEL_LOAD_FAILED`, `INFERENCE_FAILED`).
- [x] `dispose` cleanly terminates background Web Worker threads and clears active promises.
- [x] Headless unit tests in `src/__tests__/separationEngine.test.ts` verify end-to-end separation, ordered telemetry progression, AbortSignal cancellation, worker reuse, typed error rejection, and disposal using a mock worker without browser DOM or WebAudio dependencies.

## Answer

Implemented `src/lib/separationEngine.ts` with `createSeparationEngine`, polymorphic audio extraction, worker reuse across matching model profiles, standard `AbortSignal` cancellation, strongly typed telemetry events (`downloading`, `initializing`, `separating`), and structured `SeparationError` mapping. Fully tested in `src/__tests__/separationEngine.test.ts` with 9 passing headless unit tests.
