# Map: Demuxify Web

Implementation map for Demuxify Web.

## Notes
- Frontier begins with Ticket 01 (Project skeleton, PWA, WebGPU detection).
- Ticket graph: 01 -> 02 -> 03 -> 04 -> [05, 06, 07].

## Decisions so far
- [Ticket 01 Resolved](issues/01-project-skeleton-pwa-webgpu.md): Vite + React + TS + Tailwind + Vitest + PWA manifest & SW. `detectWebGPUCapability()` checks `navigator.gpu` and requests adapter/device with cleanup. UI shell with WebGPU status indicator and Source Mix dropzone.
- [Ticket 02 Resolved](issues/02-source-mix-ingestion-master-waveform.md): Audio decoding in `src/lib/audioDecoder.ts` for MP3, WAV, FLAC, AAC, OGG. Envelope peak extraction in `src/lib/waveformPeaks.ts`. Interactive canvas `src/components/MasterWaveform.tsx` with tick markers and drag-scrubbing. Source mix metadata card in `src/components/SourceMixCard.tsx`.
- [Ticket 03 Resolved](issues/03-inference-engine-worker-model-cache.md): Persistent model caching in `src/lib/modelCache.ts`. Chunking and Hann overlap-add blending in `src/lib/chunkOverlapAdd.ts`. Web worker inference pipeline in `src/workers/inference.worker.ts` and `src/lib/inferenceClient.ts` with progress & cancel support. `src/components/SeparationProgress.tsx` with ETA and chunk metrics.




## Fog
- Model weights: HTDemucs ONNX format in browser runtime (WebGPU / WASM fallback).
- Real-time AudioWorklet WSOLA cross-stem processing.

