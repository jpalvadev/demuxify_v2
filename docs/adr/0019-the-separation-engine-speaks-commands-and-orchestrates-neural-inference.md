# The Separation Engine Speaks Commands and Orchestrates Neural Inference

Extends [ADR-0001](./0001-pwa-webgpu-onnxruntime.md) (WebGPU ONNX Runtime execution), [ADR-0005](./0005-fixed-device-model-profiles-and-centralized-identity.md) (Model Profiles), [ADR-0016](./0016-the-player-engine-speaks-commands-and-reports-one-mixer-state.md) (Player Engine commands in, snapshot out), [ADR-0017](./0017-the-export-engine-speaks-commands-and-renders-one-export-payload.md) (Export Engine commands in, snapshot out), and [ADR-0018](./0018-the-session-manager-speaks-commands-and-coordinates-in-memory-state-and-persistence.md) (Session Manager commands in, snapshot out).

## Context

Prior to this decision, neural network audio separation was orchestrated directly inside the root application component (`src/App.tsx`). The existing helper (`src/lib/inferenceClient.ts`) was merely a shallow message-passing wrapper around a Web Worker (`src/workers/inference.worker.ts`), forcing high-level orchestration, state tracking, and data preparation into the UI:

1. **Root Shell Coordination Sprawl**: `handleStartSeparation` in `src/App.tsx` manually managed model profile lookup (`getModelProfile`), test-environment detection (`process.env.NODE_ENV === "test"`), worker initialization with download progress callbacks, manual multi-channel slicing from `AudioBuffer` into `Float32Array[]`, and worker invocation.
2. **Scattered UI State Machine**: Five independent React state variables (`separationPhase`, `downloadProgress`, `chunkProgress`, `chunkStart`, `separationError`) were maintained across `src/App.tsx` and forwarded as loose props into `src/components/SeparationProgress.tsx`. This loose coupling permitted impossible intermediate states (e.g. chunk progress remaining mounted during download or error states).
3. **Leaky Worker Lifecycle**: A persistent `InferenceClient` instance was maintained in a component ref (`inferenceClientRef`) inside `src/App.tsx`, requiring manual worker termination on component unmount and imperative `.cancel()` invocation upon clearing the Source Mix.
4. **Ad-Hoc Cancellation & Error Detection**: Cancellation was triggered imperatively via custom method calls, and error handling in `src/App.tsx` previously depended on fragile regex parsing of error message strings (`cancelledRegex`).

## Decision

Consolidate neural network separation orchestration, model profile resolution, worker pool lifecycle, and progress telemetry into a headless, deep **Separation Engine** module (`src/lib/separationEngine.ts`) following a command-driven, promise-based execution seam:

1. **Headless Separation Engine Core (`src/lib/separationEngine.ts`):**
   - Created via factory function: `createSeparationEngine(config?: SeparationEngineConfig): SeparationEngine`.
   - Exposes a clean, promise-based execution seam: `separate(request: SeparationRequest, options?: SeparationOptions): Promise<SeparationResult>`.
   - Exposes deterministic worker and WebGPU resource teardown: `dispose(): void`.
   - Persists the active Web Worker across consecutive separations, avoiding redundant model re-downloads and shader recompilations when the same Model Profile is reused.

2. **Polymorphic Audio Input & Internal Channel Slicing:**
   - The execution seam accepts `SeparationSource = AudioBuffer | { channels: Float32Array[]; sampleRate: number }`.
   - The engine extracts audio channel arrays internally, eliminating the manual channel slicing loop from `src/App.tsx` while allowing headless tests to supply pure numeric arrays without browser WebAudio mocks.

3. **Authoritative Self-Describing Result:**
   - Returns a comprehensive result payload:
     ```typescript
     export interface SeparationResult {
       stems: Record<StemName, Float32Array[]>;
       duration: number;
       sampleRate: number;
       modelProfileId: ModelId;
       backend: "webgpu" | "wasm" | "mock";
     }
     ```
   - Callers (such as Session creation in `src/App.tsx`) receive all execution facts directly from the result without maintaining parallel state.

4. **Standard Web API Cancellation via `AbortSignal`:**
   - Cancellation is governed strictly via standard Web API `AbortSignal` (`options.signal?: AbortSignal`).
   - Aborting mid-flight sends `{ type: "cancel" }` to the worker and rejects the promise cleanly with a standard `AbortError` (DOMException), eliminating manual cancel flags and regex checks.

5. **Strongly-Typed Progress Telemetry:**
   - Progress events are unified into a discriminated union `SeparationProgressEvent`:
     - `{ stage: "downloading"; loadedBytes: number; totalBytes: number; progress: number }`
     - `{ stage: "initializing"; backend: "webgpu" | "wasm" | "mock" }`
     - `{ stage: "separating"; chunkIndex: number; totalChunks: number; progress: number; elapsedMs: number; etaMs: number }`
   - Overall success is signaled by Promise resolution (`SeparationResult`); failure or cancellation is signaled by Promise rejection.
   - `src/App.tsx` collapses its five loose states into a single atomic state:
     ```typescript
     export type SeparationUiState =
       | { status: "idle" }
       | { status: "active"; event: SeparationProgressEvent }
       | { status: "error"; error: string };
     ```
   - `src/components/SeparationProgress.tsx` becomes a pure view rendering directly from `SeparationUiState`.

6. **Worker-Side Reconstruction Preserved:**
   - Chunk segmentation (`createChunkSegments`), STFT/ISTFT transforms, and stem assembly (`reconstructStemsFromChunks`) remain strictly inside the Web Worker (`src/workers/inference.worker.ts`).
   - The main thread orchestrates progress and lifecycle, keeping heavy multi-megabyte audio reconstruction off the UI thread.

7. **Structured Domain Errors:**
   - Emits structured `SeparationError` with machine-readable codes (`"OOM" | "BACKEND_UNAVAILABLE" | "MODEL_LOAD_FAILED" | "INFERENCE_FAILED"`).
   - User cancellations reject with standard `AbortError`.

8. **Retirement of Shallow Wrapper:**
   - The obsolete shallow class `InferenceClient` in `src/lib/inferenceClient.ts` is retired and deleted, replaced entirely by `src/lib/separationEngine.ts`.

## Considered Options

- **Keep `InferenceClient` and wrap it** (rejected: introduces an unnecessary shallow middle layer; `SeparationEngine` directly manages the worker interface).
- **Move chunk overlap-add reconstruction to the main thread** (rejected: transfers high-volume audio chunks across the IPC boundary on every slice, increasing memory churn and risking UI frame drops).
- **Stateful store with `subscribe()` instead of Promise** (rejected: audio separation is a discrete, single-pass processing task with a clear beginning and end; a promise-based execution seam with `AbortSignal` matches `exportAudio` and is significantly simpler).
- **Couple Separation Engine to secondary Tempo / Beat Grid analysis** (rejected: violates single responsibility; downstream analysis on isolated stems belongs to session coordination in `src/App.tsx`).

## Consequences

- Neural network inference orchestration, model caching, and progress telemetry are fully testable in milliseconds in pure Node/Vitest without mounting React components.
- `src/App.tsx` sheds over 100 lines of worker management, channel slicing loops, and fragmented state variables.
- `src/components/SeparationProgress.tsx` is transformed into a pure view driven by a clean discriminated union.
- `src/lib/inferenceClient.ts` is retired.
- All pre-commit guardrails (`check:glossary`, `check:doc-anchors`, `check:test-fixtures`, `check:testids`, `check:retired-affordances`, `check:dist-fresh`) pass cleanly.
