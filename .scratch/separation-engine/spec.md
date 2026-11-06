# Spec: Separation Engine — Deepen the Audio Separation Pipeline behind a Headless Engine

Status: ready-for-agent

Recorded on the tracker 2026-11-06. This is the architectural deepening increment for Candidate 3 of the 2026-11-06 architecture review: consolidating model profile resolution, Web Worker lifecycle management, progress telemetry translation, and cancellation into a deep **Separation Engine** module. The user affordances, model profiles, client-side WebGPU execution, and audio quality remain invariant. Glossary terms used throughout: **Separation Engine**, **Inference Engine**, **Source Mix**, **Stem**, **Stem Player**, **Player Engine**, **Export Engine**, **Model Profile**, **Model Cache**, **Chunk Segment**, **Session**, **Session Manager**, **Tab Shell**, **Tab**, **Beat Grid**, **Click Track**, **Tempo Detector**.

## Problem Statement

Currently, neural network audio separation orchestration is tangled inside the root application shell component (`App.tsx`). The existing helper (`inferenceClient.ts`) operates merely as a shallow message-passing wrapper around a Web Worker, leaving high-level coordination, data preparation, state tracking, and lifecycle management to be manually managed by the UI component:

1. **Root Shell Coordination Sprawl**: The root application component manually manages model profile lookup, test-environment detection, worker initialization with download progress callbacks, manual channel slicing from `AudioBuffer` into raw numeric arrays, and worker invocation.
2. **Scattered UI State Machine**: Five independent React state variables (`separationPhase`, `downloadProgress`, `chunkProgress`, `chunkStart`, `separationError`) are maintained in the root component and passed as loose props to the progress display component. This loose coupling permits impossible intermediate states (such as chunk progress remaining visible while in a download or error state).
3. **Leaky Worker Lifecycle**: A persistent client instance is maintained in a component ref inside the root component, requiring manual worker termination on component unmount and imperative cancellation calls upon clearing the Source Mix.
4. **Ad-Hoc Cancellation & Error Detection**: Cancellation is triggered imperatively through custom method calls rather than standard Web APIs, and error detection in the root component depends on fragile regex matching of error message strings.
5. **Fragile Testing**: Testing separation error handling, cancellation, or progress reporting currently requires either mocking low-level worker message protocols or driving complex React component trees in UI integration suites.

## Solution

Consolidate neural network separation orchestration, model profile resolution, worker pool lifecycle, and progress telemetry into a headless, deep **Separation Engine** module following a command-driven, promise-based execution seam:

1. **Headless Separation Engine Core**:
   - Presents a clean, promise-based execution seam: `separate(request, options): Promise<SeparationResult>`.
   - Manages worker pool creation, reuse across runs with matching Model Profiles, and deterministic cleanup via `dispose()`.
   - Encapsulates test-environment detection and mock worker injection internally.
2. **Polymorphic Audio Input & Channel Slicing**:
   - Accepts either a browser `AudioBuffer` or raw numeric channel arrays (`{ channels: Float32Array[]; sampleRate: number }`), performing channel extraction internally and eliminating manual slicing loops from the UI shell.
3. **Authoritative Self-Describing Result**:
   - Returns a comprehensive result payload containing separated Stems, duration, sample rate, active model profile ID, and active execution backend, eliminating parallel state tracking in callers.
4. **Standard Web API Cancellation via AbortSignal**:
   - Standardizes cancellation on Web API `AbortSignal`, cleanly halting the worker and rejecting the promise with a standard `AbortError` (DOMException).
5. **Strongly-Typed Progress Telemetry**:
   - Collapses the five loose states into a single discriminated union `SeparationProgressEvent` (`downloading`, `initializing`, `separating`), enabling the root component to maintain a single atomic `SeparationUiState`.
6. **Worker-Side Audio Reconstruction**:
   - Preserves chunk slicing, STFT/ISTFT transforms, and stem assembly inside the Web Worker to keep heavy multi-megabyte audio reconstruction off the browser UI thread.
7. **Structured Domain Errors**:
   - Translates worker failures and out-of-memory crashes into structured domain errors with machine-readable codes (`OOM`, `BACKEND_UNAVAILABLE`, `MODEL_LOAD_FAILED`, `INFERENCE_FAILED`).
8. **Retirement of Shallow Wrapper**:
   - Retires and removes the obsolete shallow class `InferenceClient`.

## User Stories

1. As a music producer using Demuxify Web, I want to separate a Source Mix into 4 isolated Stems (Vocals, Drums, Bass, Other) with a single action, so that I can immediately start remixing and practicing.
2. As a music producer, I want to see a clear download progress bar with loaded megabytes when model weights are being retrieved, so that I understand download progress on slow connections.
3. As a music producer, I want to see the active inference stage, current chunk number, total chunk count, elapsed time, and estimated time remaining during separation, so that I know exactly how long processing will take.
4. As a user on a laptop with WebGPU, I want the application to automatically use GPU acceleration for fast separation, so that my stems are ready with minimal waiting.
5. As a user on a device without WebGPU, I want the application to fall back gracefully to WebAssembly inference, so that separation still succeeds reliably on unsupported devices.
6. As a music producer, I want clicking 'Cancel' during separation to halt inference immediately and return the interface to idle, so that my computer stops burning CPU/GPU cycles when I change my mind.
7. As a music producer, I want clearing my Source Mix to cancel any active separation in flight, so that abandoned separation jobs do not run in the background.
8. As a music producer, I want consecutive separations using the same Model Profile to reuse the already loaded model and compiled shaders, so that subsequent separations start instantly without re-downloading or re-parsing weights.
9. As a mobile or memory-constrained user, I want out-of-memory errors (such as WASM heap allocation failures) to display a friendly explanation advising me to close background tabs, so that I understand why separation failed rather than seeing a cryptic crash.
10. As a music producer, I want network failures during model download to provide a clean retry option, so that I can resume after a transient connection drop.
11. As a developer maintaining the codebase, I want separation progress, cancellation, and error handling to be testable headlessly in Node/Vitest without mounting React components or mocking WebAudio, so that test suites run in milliseconds.
12. As a developer navigating the codebase, I want the separation subsystem to present a single promise-based execution seam (`separateAudio`), so that the caller interface is simple and predictable.
13. As a developer, I want all progress telemetry to arrive as a strongly-typed discriminated union, so that impossible intermediate UI states cannot be represented in TypeScript.
14. As an audio engineer, I want chunk overlap-add reconstruction to happen strictly off the main thread in a Web Worker, so that the application's UI animations and audio playback remain fluid at 60 FPS without stutter.
15. As a developer, I want the Separation Engine to be decoupled from downstream tempo detection and session creation, so that each subsystem adheres strictly to single responsibility.

## Implementation Decisions

### Decision 1: Domain Entity and Seam Identity

- Establish **Separation Engine** in the domain glossary as the headless coordinator that transforms a Source Mix into isolated Stems.
- Retain **Inference Engine** strictly as the client-side execution runtime running the neural network model inside the Web Worker.
- Retire and delete the obsolete shallow wrapper `InferenceClient`.

### Decision 2: Promise-Based Execution Seam with AbortSignal

- The Separation Engine exposes a clean promise-based execution seam:
  ```ts
  interface SeparationEngine {
    separate(
      request: SeparationRequest,
      options?: SeparationOptions
    ): Promise<SeparationResult>;
    dispose(): void;
  }
  ```
- Cancellation is governed strictly via standard Web API `AbortSignal`:
  ```ts
  interface SeparationOptions {
    signal?: AbortSignal;
    onProgress?: (event: SeparationProgressEvent) => void;
  }
  ```
- Aborting mid-flight halts the worker immediately and rejects the promise cleanly with a standard `AbortError` (DOMException).

### Decision 3: Polymorphic Audio Input & Channel Extraction

- The request payload accepts either an `AudioBuffer` or pure numeric channel arrays:
  ```ts
  type SeparationSource =
    AudioBuffer | { channels: Float32Array[]; sampleRate: number };

  interface SeparationRequest {
    source: SeparationSource;
    modelProfileId?: ModelId;
    preferredBackend?: "webgpu" | "wasm";
  }
  ```
- The engine handles multi-channel extraction internally, freeing the UI layer from iterating over audio buffer channels.

### Decision 4: Self-Describing Separation Result

- The execution seam returns a comprehensive result payload:
  ```ts
  interface SeparationResult {
    stems: Record<StemName, Float32Array[]>;
    duration: number;
    sampleRate: number;
    modelProfileId: ModelId;
    backend: "webgpu" | "wasm" | "mock";
  }
  ```
- Callers (such as Session creation) derive all needed facts directly from the result without external lookups.

### Decision 5: Strongly-Typed Discriminated Union Telemetry

- Progress events emitted via `onProgress` follow a discriminated union with three active stages:
  ```ts
  type SeparationProgressEvent =
    | {
        stage: "downloading";
        loadedBytes: number;
        totalBytes: number;
        progress: number;
      }
    | {
        stage: "initializing";
        backend: "webgpu" | "wasm" | "mock";
      }
    | {
        stage: "separating";
        chunkIndex: number;
        totalChunks: number;
        progress: number;
        elapsedMs: number;
        etaMs: number;
      };
  ```
- Terminal success is represented by Promise resolution; failure and cancellation are represented by Promise rejection.
- The UI layer consolidates loose state variables into a single atomic state:
  ```ts
  type SeparationUiState =
    | { status: "idle" }
    | { status: "active"; event: SeparationProgressEvent }
    | { status: "error"; error: string };
  ```

### Decision 6: Worker Lifecycle & Cache Reuse

- Instantiation is governed by a factory function:
  ```ts
  interface SeparationEngineConfig {
    useMock?: boolean;
    workerFactory?: () => Worker;
  }

  function createSeparationEngine(
    config?: SeparationEngineConfig
  ): SeparationEngine;
  ```
- The engine maintains a persistent Web Worker across consecutive separation runs, avoiding redundant weight downloads and shader compilations when the same Model Profile is reused.
- `dispose()` deterministically terminates the worker thread and releases WebGPU allocations.

### Decision 7: Worker-Side Reconstruction Preserved

- Chunk segmentation, STFT/ISTFT transforms, and overlap-add stem reconstruction remain strictly inside the Web Worker. The main thread receives only lightweight progress events and the final assembled Stems.

### Decision 8: Structured Domain Errors

- Domain errors are encapsulated in a typed error hierarchy:
  ```ts
  type SeparationErrorCode =
    "OOM" | "BACKEND_UNAVAILABLE" | "MODEL_LOAD_FAILED" | "INFERENCE_FAILED";

  class SeparationError extends Error {
    readonly code: SeparationErrorCode;
  }
  ```

## Testing Decisions

- **Good Test Philosophy**: Tests must exercise the public execution seam (`separate`), verifying observable stem outputs, progress event sequences, cancellation semantics, and structured error rejection, without asserting private worker message formats or internal state flags.
- **Primary Seam**: Headless unit test suite exercising `SeparationEngine` directly in Node/Vitest with a mock worker:
  1. Successful end-to-end separation returning valid 4-stem structures.
  2. Ordered progress event progression (`downloading` -> `initializing` -> `separating`).
  3. Immediate cancellation via `AbortSignal`, verifying worker cancel postMessage and `AbortError` rejection.
  4. Polymorphic input handling (`AudioBuffer` vs `{ channels, sampleRate }`).
  5. Worker reuse across calls with matching profiles, and re-initialization when profile changes.
  6. Structured `SeparationError` translation on simulated worker crashes and memory allocation failures.
  7. Clean worker termination on `dispose()`.
- **Secondary Seam**: Component-level integration tests (`App.test.tsx`) asserting that the UI triggers separation, renders the unified `SeparationProgress` view, cleanly handles user cancellation, and transitions to the Mix Tab upon completion.
- **Prior Art**: The command-and-snapshot test patterns established for Player Engine (`src/__tests__/stemPlayerEngine.test.ts`), Export Engine (`src/__tests__/exportEngine.test.ts`), and Session Manager (`src/__tests__/sessionManager.test.ts`).

## Out of Scope

- Changes to the underlying ONNX neural network model architectures (BS-RoFormer, HT-Demucs, Open-Unmix) or exported model weight files.
- Visual redesign of the progress card or change of brand color tokens (already governed by stitch skin).
- Automatic triggering of downstream tempo detection or Session creation (coordinated by the application layer).
- Multi-worker parallel chunk distribution across multiple GPUs (Demuxify uses a single worker for browser memory safety).

## Further Notes

- Retiring `InferenceClient` eliminates a shallow, leaky layer of indirection.
- All code identifiers and file paths adhere to `CODING_STANDARDS.md`, `check:glossary`, and `check:doc-anchors`.
- Architectural decision record **ADR-0019** documents the structural deepening and trade-offs of this subsystem.
