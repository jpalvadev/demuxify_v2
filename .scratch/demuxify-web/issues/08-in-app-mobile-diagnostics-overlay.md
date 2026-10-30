# 08: In-App Mobile Diagnostics & Error Overlay

**What to build:** The user toggles an in-app diagnostics and logging overlay drawer on mobile and desktop browsers to inspect real-time console messages, WebGPU/WASM capability status, Web Worker errors, model download progress, and heap/memory warnings without requiring external browser developer tools or USB debugging.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Global error and console interceptor that captures `console.error`, `console.warn`, and unhandled promise/worker rejections in an in-memory ring buffer.
- [x] Floating, non-intrusive diagnostics toggle button (e.g. badge in footer/header or floating pill) that opens a mobile-friendly collapsible diagnostics panel.
- [x] Panel displays current device environment: user agent, WebGPU support details, Web Worker state, Cache Storage status, and error stack traces with a "Copy to Clipboard" button.
- [x] Real-time event streaming showing exact step where separation stalls (network fetch, arrayBuffer allocation, ONNX session creation, WASM execution).
- [x] Unit tests asserting diagnostic log interception, formatting, and clipboard export functionality.

## Answer

Implemented in-app diagnostics and mobile error overlay:

- `src/lib/diagnostics.ts`: `DiagnosticsLogger` class with in-memory ring buffer, level/category tagging, global `console.error`/`console.warn`/window error interceptors, environment probe (WebGPU adapter, JS Heap memory, user agent, cache storage), and markdown diagnostic report generation.
- `src/components/DiagnosticsOverlay.tsx`: Floating pill trigger with dynamic error/warning counter badge and responsive slide-over drawer featuring log filtering (All, Error, Warn, Info), expandable error stacks and JSON payloads, device environment specs, log clearing, and single-tap "Copy Report" clipboard exporter.
- Integrated into `src/lib/inferenceClient.ts` and `src/lib/modelCache.ts` to trace model downloads, cache hits, worker initialization, and uncaught worker terminations.
- Mounted in `src/App.tsx` with lifecycle interceptor setup/teardown.
- Added comprehensive unit tests in `src/__tests__/diagnostics.test.ts` and `src/__tests__/DiagnosticsOverlay.test.tsx` (all passing).
