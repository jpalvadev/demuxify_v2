# 11: Mobile Web Inference Stability & Memory Fallback Strategy

**What to build:** The user can reliably run stem separation on supported mobile browsers, or receives an immediate, accurate diagnostic advisory if the mobile device hardware or browser lacks the memory or WebGPU capabilities required for the 270 MB neural network weights.

**Blocked by:** 08: In-App Mobile Diagnostics & Error Overlay

**Status:** ready-for-agent

- [ ] Identify root-cause mobile failure via in-app diagnostics (WASM memory limit, network streaming abort, or WebGPU adapter failure).
- [ ] Optimize model downloading and memory footprint in `modelCache.ts` and `inference.worker.ts` (e.g. avoid duplicate in-memory buffer copies, configure ONNX WASM memory settings for constrained mobile heaps).
- [ ] Provide upfront hardware/browser pre-flight check warning users on low-memory mobile devices before initiating the 270 MB download.
- [ ] Unit and integration tests covering low-memory failure handling and user-facing error guidance.
