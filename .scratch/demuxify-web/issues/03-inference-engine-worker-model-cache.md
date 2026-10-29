# 03: Inference Engine Web Worker & Model Cache Pipeline

**What to build:** The user starts the separation process on the ingested Source Mix; the application downloads the HTDemucs v4 model weights into the persistent Model Cache (with visual download progress), executes chunked tensor processing via WebGPU inside a dedicated Web Worker across sequential Chunk Segments, displays real-time progress, and produces four discrete isolated Stems (Vocals, Drums, Bass, Other).

**Blocked by:** 02: Source Mix Ingestion & Master Waveform Overview

**Status:** resolved

- [x] Model Cache integration using Cache API / OPFS to persist ONNX model weights across browser sessions without re-downloading.
- [x] Dedicated Inference Engine Web Worker hosting ONNX Runtime Web with WebGPU execution provider and WASM CPU fallback.
- [x] Source Mix slicing into sequential Chunk Segments with overlap-add blending windowing to prevent boundary artifacts.
- [x] Non-blocking UI communication reporting model download progress, chunk processing progress, elapsed time, and ETA.
- [x] User ability to cancel ongoing separation at any time, halting the worker and releasing GPU tensor buffers.
- [x] Separation completion yields four discrete Float32 PCM Stems: Vocals, Drums, Bass, and Other.
- [x] Automated tests mocking ONNX inference verifying chunk scheduling, progress events, cancellation, and 4-stem buffer reconstruction.

## Answer
Implemented the neural separation pipeline with:
- `src/lib/modelCache.ts`: Persistent storage of ONNX weights with streaming progress callbacks.
- `src/lib/chunkOverlapAdd.ts`: Chunk segmentation with Hann overlap-add blending across sequential Chunk Segments.
- `src/workers/inference.worker.ts`: ONNX Runtime Web worker supporting WebGPU and WASM fallback, message handling for init/start/cancel, and simulated execution for mock environments.
- `src/lib/inferenceClient.ts`: Clean high-level controller managing worker lifecycles, progress subscriptions, and cancellation.
- `src/components/SeparationProgress.tsx`: Progress bar with ETA, chunk counter, download stats, and cancel action.
- Application integration in `src/App.tsx` and 60 comprehensive unit and integration tests passing.

