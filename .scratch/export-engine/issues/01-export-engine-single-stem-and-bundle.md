# 01: The Headless Export Engine — Single Stem & Full Bundle

**What to build:** An autonomous, headless audio export core (`exportAudio`) capable of exporting a single Stem or a full multi-track Export Bundle as WAV (16-bit or 24-bit PCM) or MP3 (configurable bitrate). When active Time-Stretch adjustments are requested, the engine coordinates offline rendering via Signalsmith Stretch before encoding. When Click Track inclusion is requested in bundle mode, the engine synthesizes click audio pulses scaled by the active playback tempo factor and packages it alongside the stems in a ZIP archive. The engine reports progress monotonically and halts processing immediately upon receiving an `AbortSignal`.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `exportAudio` accepts `SingleStemExportRequest` (`mode: "single"`) and returns an `ExportResult` containing a valid audio `Blob`, clean filename, and MIME type for both WAV and MP3 formats.
- [x] `exportAudio` accepts `BundleExportRequest` (`mode: "bundle"`) and packages all four Stems into a valid ZIP archive `Blob` with sanitized naming for both WAV and MP3 formats.
- [x] When `applyAdjustments: true` and time-stretch/pitch-shift adjustments are active, offline rendering is performed across the target stems prior to encoding.
- [x] When `includeClickTrack: true` and click track settings/beat grid are present, a synthesized Click Track audio file is scaled by the tempo factor and bundled into the ZIP archive.
- [x] `options.onProgress` receives normalized 0..100 progress updates and descriptive status strings throughout offline render, stem encoding, and ZIP bundling stages.
- [x] Passing an aborted `AbortSignal` (or aborting mid-flight) rejects cleanly with an `AbortError` without producing partial files or unhandled worker rejections.
- [x] Comprehensive headless unit suite in `src/__tests__/exportEngine.test.ts` exercises all Single Stem and Bundle encoding paths in Node/Vitest without mounting React components or touching DOM APIs.
