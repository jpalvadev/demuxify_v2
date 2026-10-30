# Map: Demuxify Web

Implementation map for Demuxify Web.

## Notes

- Frontier begins with Ticket 01 (Project skeleton, PWA, WebGPU detection).
- Ticket graph: 01 -> 02 -> 03 -> 04 -> [05, 06, 07] -> [08, 09, 10] -> 11.
- Active Frontier: Ticket 09 (Transport/WSOLA sync), Ticket 10 (Purge Demucs legacy code), Ticket 11 (Mobile Web Inference Stability).

## Decisions so far

- [Ticket 08 Resolved](issues/08-in-app-mobile-diagnostics-overlay.md): Real-time diagnostic logging and mobile error overlay. `src/lib/diagnostics.ts` intercepting console, errors, worker events, and environment stats. `src/components/DiagnosticsOverlay.tsx` floating drawer with live log filters and markdown report export.
- [Ticket 01 Resolved](issues/01-project-skeleton-pwa-webgpu.md): Vite + React + TS + Tailwind + Vitest + PWA manifest & SW. `detectWebGPUCapability()` checks `navigator.gpu` and requests adapter/device with cleanup. UI shell with WebGPU status indicator and Source Mix dropzone.
- [Ticket 02 Resolved](issues/02-source-mix-ingestion-master-waveform.md): Audio decoding in `src/lib/audioDecoder.ts` for MP3, WAV, FLAC, AAC, OGG. Envelope peak extraction in `src/lib/waveformPeaks.ts`. Interactive canvas `src/components/MasterWaveform.tsx` with tick markers and drag-scrubbing. Source mix metadata card in `src/components/SourceMixCard.tsx`.
- [Ticket 03 Resolved](issues/03-inference-engine-worker-model-cache.md): Persistent model caching in `src/lib/modelCache.ts`. Chunking and Hann overlap-add blending in `src/lib/chunkOverlapAdd.ts`. Web worker inference pipeline in `src/workers/inference.worker.ts` and `src/lib/inferenceClient.ts` with progress & cancel support. `src/components/SeparationProgress.tsx` with ETA and chunk metrics.
- [Ticket 04 Resolved](issues/04-stem-player-multitrack-sync.md): Multi-track Web Audio API engine in `src/lib/stemPlayerEngine.ts` with synchronized play/pause/seek and solo/mute gain matrix. `src/components/StemTrack.tsx` with faders and canvas waveforms. `src/components/StemPlayer.tsx` with transport bar and spacebar control.
- [Ticket 05 Resolved](issues/05-audioworklet-wsola-time-stretch.md): AudioWorklet WSOLA engine in `src/lib/wsolaProcessor.ts` supporting 4 concurrent stereo stems with inter-stem phase coherence, independent tempo scaling (0.5x - 2.0x), and pitch transposition (-12 to +12 st). Integrated UI controls in `src/components/StemPlayer.tsx`.
- [Ticket 06 Resolved](issues/06-session-persistence-indexeddb-opfs.md): Dual-tier IndexedDB and OPFS storage in `src/lib/sessionStore.ts` storing multi-channel Float32Array PCM buffers and mixer states. Debounced auto-save, startup recovery banner in `src/components/SessionRecovery.tsx`, and session purge.
- [Ticket 07 Resolved](issues/07-export-pipeline-bundle-zip.md): Full export pipeline with standard RIFF WAVE encoder (16/24-bit PCM), dedicated background MP3 export worker using LameJS (128/192/256/320 kbps), PKZIP bundle generator packaging all 4 stems into a single archive, and interactive ExportDialog integrated into StemPlayer.

## Fog

- Model weights: HTDemucs ONNX format in browser runtime (WebGPU / WASM fallback).
- Real-time AudioWorklet WSOLA cross-stem processing.
