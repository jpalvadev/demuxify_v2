# 11: Mobile Web Inference Stability & Memory Fallback Strategy

**What to build:** The user can reliably run stem separation on supported mobile browsers, or receives an immediate, accurate diagnostic advisory if the mobile device hardware or browser lacks the memory or WebGPU capabilities required for the 270 MB neural network weights.

**Blocked by:** 08: In-App Mobile Diagnostics & Error Overlay

**Status:** resolved

- [x] Identify root-cause mobile failure via in-app diagnostics (WASM memory limit, network streaming abort, or WebGPU adapter failure).
- [x] Optimize model downloading and memory footprint in `modelCache.ts` and `inference.worker.ts` (e.g. avoid duplicate in-memory buffer copies, configure ONNX WASM memory settings for constrained mobile heaps).
- [x] Provide upfront hardware/browser pre-flight check warning users on low-memory mobile devices before initiating the 270 MB download.
- [x] Unit and integration tests covering low-memory failure handling and user-facing error guidance.

## Answer

Identified and resolved mobile Adreno WebGPU driver hang issue:

- Diagnosed root-cause via Ticket 08 in-app logs: Qualcomm Adreno GPU driver deadlocks in Chromium/Dawn when executing complex BS-RoFormer WGSL compute shaders.
- Updated `src/lib/webgpu.ts` to detect Qualcomm Adreno GPUs and route to CPU/WASM fallback automatically.
- Configured ONNX Runtime multi-threaded WASM execution in `src/workers/inference.worker.ts` utilizing up to 4 CPU threads with SIMD acceleration.
- Implemented double-guardrail detection in both main thread (`InferenceClient` / `detectWebGPUCapability`) and background worker (`handleInit`).
- Updated `SeparationProgress.tsx` with live second counter and informative stage indicator for CPU/WASM execution.
- Added comprehensive unit tests in `src/__tests__/webgpu.test.ts` and `src/__tests__/SeparationProgress.test.tsx` (all 183 tests passing).
