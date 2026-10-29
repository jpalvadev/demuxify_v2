# Map: Demuxify Web

Implementation map for Demuxify Web.

## Notes
- Frontier begins with Ticket 01 (Project skeleton, PWA, WebGPU detection).
- Ticket graph: 01 -> 02 -> 03 -> 04 -> [05, 06, 07].

## Decisions so far

## Fog
- Model weights: HTDemucs ONNX format in browser runtime (WebGPU / WASM fallback).
- Real-time AudioWorklet WSOLA cross-stem processing.
