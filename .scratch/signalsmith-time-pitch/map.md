# Map: High-Fidelity WASM Time-Stretch & Pitch-Shifting Engine

## Notes

- Feature branch: `feat/signalsmith-time-pitch`
- Library: `signalsmith-stretch` (WASM / AudioWorklet)
- ADR: `docs/adr/0006-signalsmith-stretch-wasm-time-pitch.md`

## Decisions so far

- Initialized integration branch `feat/signalsmith-time-pitch` from baseline.
- `signalsmith-stretch` installed.
- [Ticket 01 Resolved](file:///c:/Programacion/demuxify_v2/.scratch/signalsmith-time-pitch/issues/01-quantized-stepped-ui-controls.md): Stepped tempo slider (0.25x steps), 7-preset grid, integer pitch semitones [-12, +12], and reset button state in `StemPlayer.tsx`.
- [Ticket 02 Resolved](file:///c:/Programacion/demuxify_v2/.scratch/signalsmith-time-pitch/issues/02-signalsmith-stretch-wasm-adapter.md): Modular Signalsmith Stretch WASM adapter (`src/lib/signalsmithStretchAdapter.ts`), 4-stem synchronization, selective vocal formant compensation, test fallback, and tests.
- [Ticket 03 Resolved](file:///c:/Programacion/demuxify_v2/.scratch/signalsmith-time-pitch/issues/03-stem-player-multitrack-wasm-integration.md): Stem Player multi-track WASM integration in `StemPlayerEngine.ts`, accessible Vocal Formant Preservation toggle in `StemPlayer.tsx`, canonical duration anchoring, and tests.
- [Ticket 04 Resolved](file:///c:/Programacion/demuxify_v2/.scratch/signalsmith-time-pitch/issues/04-offline-mixdown-and-export-pipeline.md): Offline rendering pipeline (`renderOfflineStems`), ExportDialog pitch & tempo adjustments toggle, single stem/bundle/mixdown offline export, and tests.
- [Code Review & Verification Complete]: Parallel Standards and Spec subagent reviews conducted; addressed all review feedback (native AudioWorklet detection, removed hardcoded timeout, end-of-track auto-pause, offline export per-stem efficiency, bundled `TimeStretchState`, restored unrelated script touch). Full test suite (37 files, 272 tests) passing with 0 errors and 0 glossary violations.

## Fog

- None.
