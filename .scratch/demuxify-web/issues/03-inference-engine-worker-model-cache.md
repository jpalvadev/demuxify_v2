# 03: Inference Engine Web Worker & Model Cache Pipeline

**What to build:** The user starts the separation process on the ingested Source Mix; the application downloads the HTDemucs v4 model weights into the persistent Model Cache (with visual download progress), executes chunked tensor processing via WebGPU inside a dedicated Web Worker across sequential Chunk Segments, displays real-time progress, and produces four discrete isolated Stems (Vocals, Drums, Bass, Other).

**Blocked by:** 02: Source Mix Ingestion & Master Waveform Overview

**Status:** claimed

- [ ] Model Cache integration using Cache API / OPFS to persist ONNX model weights across browser sessions without re-downloading.
- [ ] Dedicated Inference Engine Web Worker hosting ONNX Runtime Web with WebGPU execution provider and WASM CPU fallback.
- [ ] Source Mix slicing into sequential Chunk Segments with overlap-add blending windowing to prevent boundary artifacts.
- [ ] Non-blocking UI communication reporting model download progress, chunk processing progress, elapsed time, and ETA.
- [ ] User ability to cancel ongoing separation at any time, halting the worker and releasing GPU tensor buffers.
- [ ] Separation completion yields four discrete Float32 PCM Stems: Vocals, Drums, Bass, and Other.
- [ ] Automated tests mocking ONNX inference verifying chunk scheduling, progress events, cancellation, and 4-stem buffer reconstruction.

