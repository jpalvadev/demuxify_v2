# Spec: Export Engine — Deepen the Export Engine and Collapse the Export Tab Monolith

Status: resolved-in-full (2026-11-06)

Recorded on the tracker 2026-11-06. This is the architectural deepening increment for Candidate 1 of the 2026-11-06 architecture review: a deepening of the export pipeline and elimination of the monolithic component structure in the Export Tab. The shipped Export Tab visual layout, user affordances, and byte-exact audio outputs are the invariant promise. Glossary terms used throughout: **Export Engine**, **Export Bundle**, **Custom Mixdown**, **Stems**, **Source Mix**, **Session**, **Tab Shell**, **Tab**, **Rail**, **Click Track**, **Beat Grid**, **Time-Stretch**, **Pitch-Shift**, **Formant Preservation**, **Player Engine**, **Mixer State**, **Playhead**.

## Problem Statement

Export orchestration in Demuxify Web is tangled inside an 1,137-line UI component (`ExportDialog.tsx`). Despite ADR-0007 and ADR-0014 establishing the four-tab shell where Export is a permanent, inline tool surface, the component still carries historical "Dialog" nomenclature, dead modal props (`isOpen`, `onClose`), and dialog ARIA attributes.

More critically, the UI component acts as an ad-hoc audio processing engine. Inside React button click handlers and render loops, it directly manages:

1. Offline time-stretching and pitch-shifting via Signalsmith Stretch and Web Audio offline contexts (`renderOfflineStems`).
2. Synthesizing Click Track audio pulses scaled by the active playback tempo factor.
3. Multi-stem summing and anti-clipping headroom calculations for Custom Mixdowns (enforcing ADR-0004's -0.3 dB safety ceiling).
4. Iterative encoding of single and multi-stem audio into 16/24-bit WAV buffers or MP3 worker streams.
5. Packaging multi-stem archives into ZIP bundles (`bundleZip.ts`).
6. Managing cancellation through mutable component refs (`cancelExportRef.current`).
7. Generating DOM download side-effects via temporary object URLs and programmatic anchor clicks.

Because mathematical audio algorithms and encoding loops live inside the component, testing export functionality requires rendering a 1,000-line React component tree in jsdom (`ExportDialog.test.tsx`), clicking radio buttons, and mocking browser DOM anchor elements to verify whether anti-clipping gain or click track inclusion worked.

Furthermore, state plumbing is leaky: `StemPlayer.tsx` synthesizes a dedicated `ExportDialogState` payload and pushes it up to `App.tsx` via an `onExportDialogState` bridge, which `App.tsx` stores in component state and passes back down to the export component as loose props. Now that ADR-0016 has established the unified `StemPlayerSnapshot`, this intermediate bridge is redundant plumbing.

## Solution

The export subsystem collapses into a deep headless **Export Engine** module and a thin, focused **Export Tab** view:

1. **Deep Export Engine (`src/lib/exportEngine.ts`):**
   - Presents a single unified entry point: `exportAudio(request, context, options): Promise<ExportResult>`.
   - Discriminated request union supports `'single'`, `'bundle'`, and `'mixdown'` modes.
   - Coordinates offline Time-Stretch rendering, Custom Mixdown anti-clipping gain, Click Track synthesis, WAV/MP3 encoders, and ZIP packaging behind this single seam.
   - Pure headless output: returns `{ blob: Blob, fileName: string, mimeType: string, descriptor?: MixdownDescriptor }`.
   - Standard cancellation via `AbortSignal` (`options.signal?: AbortSignal`), cleanly stopping worker encoding loops and offline rendering.
   - Unified progress reporting via `options.onProgress?: (progress: number, stageMessage: string) => void`.

2. **Clean Export Tab View (`src/components/ExportTab.tsx`):**
   - Renamed from `ExportDialog.tsx` to match ADR-0007 and GLOSSARY terminology.
   - Purgatory: dead `isOpen`, `onClose`, modal overlays, and dialog ARIA roles are deleted.
   - Gathers user choices (format, bit depth, bitrate, mixdown sliders, active preset, click track inclusion).
   - Reads mixer and time-stretch facts directly from the active `StemPlayerSnapshot` or `Session`.
   - Calls `exportAudio` and delegates the resulting blob to a standalone browser download adapter (`triggerDownload(blob, fileName)`).

3. **Bridge Elimination in `App.tsx` and `StemPlayer.tsx`:**
   - The `ExportDialogState` interface, `onExportDialogState` prop in `StemPlayer.tsx`, and `exportDialogState` state in `App.tsx` are completely removed.
   - `ExportTab` receives context facts directly from the shell's existing state and snapshot.

4. **Testing Division:**
   - Headless unit suite `src/__tests__/exportEngine.test.ts` tests all audio math, encoding combinations, anti-clipping limits, click track inclusion, and abort signals without DOM or React.
   - Component suite `src/__tests__/ExportTab.test.tsx` tests user interactions, form controls, and view rendering.

## User Stories

1. As an Export Tab user, I want exporting a Single Stem, Full Export Bundle, or Custom Mixdown to produce the exact same audio files, bitrates, and filenames as before, so my exported audio is byte-consistent.
2. As an Export Tab user, I want the Custom Mixdown presets (Karaoke, Instrumental, Acapella, Minus Drums) to continue configuring stem mute and volume states correctly, so I can create standard backing tracks with one click.
3. As an Export Tab user, I want anti-clipping protection to continue guaranteeing -0.3 dB headroom on summed audio, so my custom mixdowns never distort.
4. As an Export Tab user, I want exported Click Tracks to stay locked to the Beat Grid and scale accurately with active Time-Stretch tempo adjustments, so metronome accompaniment aligns in external DAWs.
5. As an Export Tab user, I want cancelling an export in progress to halt immediately without downloading partial or corrupted files, so I can abort long MP3 encoding runs safely.
6. As an Export Tab user, I want the Export Tab to render inline as the third tool surface in the Tab Shell, with zero modal dialog backdrops, so navigation across tabs is seamless.
7. As an Export Tab user, I want all progress bars, percent readouts, and status messages to accurately reflect the active encoding stage, so I know how much processing remains.
8. As a screen-reader user, I want the Export Tab to expose standard tabpanel ARIA roles rather than modal dialog roles, so my assistive technology navigates it as a persistent tool panel.
9. As a phone user, I want the Export Tab to maintain its exact CSS layout, paddings, and native controls at both 390×844 and 1440×900, so visual fidelity is untouched.
10. As a developer, I want a single function `exportAudio(request, context, options)` as the entire interface of the export subsystem, so adding export capabilities requires learning one seam instead of five libraries.
11. As a developer, I want all export packaging and encoding math decoupled from React, so audio algorithms can be executed in workers or CLI scripts without DOM dependencies.
12. As a developer, I want `ExportDialogState` and its pass-through callbacks deleted from `StemPlayer.tsx` and `App.tsx`, so the Player Engine's `StemPlayerSnapshot` remains the single source of mixer truth.
13. As a developer, I want `MIXDOWN_PRESETS` and preset resolution logic housed in domain modules rather than exported from a React component, so domain facts live where they belong.
14. As a developer, I want cancellation implemented via standard Web API `AbortSignal`, so cancellation semantics are uniform and testable.
15. As a developer, I want the DOM download trigger (`URL.createObjectURL` and anchor click) isolated in an adapter function, so the export engine returns pure data.
16. As a tester, I want to verify 16-bit and 24-bit WAV generation, MP3 bitrates, anti-clipping limits, and ZIP bundle construction in pure Node/Vitest without mounting React components, so audio tests run in milliseconds.
17. As a tester, I want the Export Tab component suite to test only visual controls and user events, so UI tests stop breaking when internal audio encoding details change.
18. As a tester, I want existing parity guards and end-to-end audio export assertions to pass cleanly, so the refactor guarantees behavioral preservation.
19. As a maintainer, I want the historical "Dialog" naming debt completely retired in code and tests, so the codebase adheres strictly to ADR-0007 and GLOSSARY.md.
20. As a maintainer, I want `check:glossary`, `check:doc-anchors`, and `check:dist-fresh` to pass cleanly with zero new testids and zero retired affordance regressions.
21. As a future reader, I want ADR-0017 to record why the Export Engine speaks commands, how cancellation is governed, and why the dialog bridge was purged, so future refactors preserve these boundaries.

## Implementation Decisions

### 1. The Headless Export Engine Module

A new module is created at the audio core:

- **Module**: `src/lib/exportEngine.ts`
- **Seam**: `exportAudio(request: ExportRequest, context: ExportContext, options?: ExportOptions): Promise<ExportResult>`
- **Request Type (Discriminated Union on `mode`)**:
  - `SingleStemExportRequest`: `{ mode: "single", stem: StemName, format: ExportFormat, bitDepth?: 16 | 24, bitrate?: Mp3Bitrate, applyAdjustments?: boolean }`
  - `BundleExportRequest`: `{ mode: "bundle", format: ExportFormat, bitDepth?: 16 | 24, bitrate?: Mp3Bitrate, applyAdjustments?: boolean, includeClickTrack?: boolean }`
  - `MixdownExportRequest`: `{ mode: "mixdown", format: ExportFormat, bitDepth?: 16 | 24, bitrate?: Mp3Bitrate, applyAdjustments?: boolean, stemGains: Record<StemName, number>, masterGain: number, antiClipping: boolean, preferInstrumental?: boolean }`
- **Context Type**:
  - `ExportContext`: `{ stems: Record<StemName, Float32Array[] | AudioBuffer>, sampleRate: number, sourceMixTitle: string, timeStretch?: { tempo: number; pitch: number; formantPreservation?: boolean }, clickTrack?: { beatGrid?: Float64Array | null; settings?: ClickTrackMixerState | null } }`
- **Options Type**:
  - `ExportOptions`: `{ onProgress?: (progress: number, stageMessage: string) => void, signal?: AbortSignal }`
- **Result Type**:
  - `ExportResult`: `{ blob: Blob, fileName: string, mimeType: string, descriptor?: MixdownDescriptor }`

### 2. Internal Collaborator Coordination

Inside `src/lib/exportEngine.ts`, the engine coordinates the existing specialized modules:

- Offline time-stretch rendering: calls `renderOfflineStems` from `src/lib/signalsmithStretchAdapter.ts` when `applyAdjustments` is requested.
- Custom mixdown summing and anti-clipping: calls `renderCustomMixdown` and `resolveMixdownDescriptor` from `src/lib/customMixdown.ts`.
- Click track synthesis: synthesizes scaled click samples using the beat grid and time-stretch tempo factor.
- Encoders: calls `encodeWav` / `createWavBlob` (`src/lib/wavEncoder.ts`) and `encodeMp3` / `createMp3Blob` (`src/lib/mp3Encoder.ts`).
- Packaging: calls `createBundleZip` (`src/lib/bundleZip.ts`) for multi-stem ZIP bundles.
- Progress math: aggregates sub-stage progress into a normalized 0..100 integer.
- Cancellation: checks `signal?.aborted` between stages and handles abort events cleanly.

### 3. Domain Relocations

- `MIXDOWN_PRESETS` and `computeInitialStemControls` move from `ExportDialog.tsx` into `src/lib/customMixdown.ts` (or are re-exported through `exportEngine.ts`).
- `GLOSSARY.md` gains **Export Engine**; **Export Tab** is clarified as the official Tab surface.
- `ADR-0017` is authored in `docs/adr/0017-the-export-engine-speaks-commands-and-renders-one-export-payload.md`.

### 4. UI Restructuring: `ExportDialog.tsx` to `ExportTab.tsx`

- File renamed to `src/components/ExportTab.tsx`.
- Component renamed to `ExportTab`.
- Obsolete props removed: `isOpen`, `onClose`, `initialMixerStates`, `initialMasterVolume`, `activeTimeStretch`.
- Direct props supplied: `stems`, `sampleRate`, `sourceMixTitle`, `timeStretch`, `clickTrackBeatGrid`, `clickTrackSettings`.
- Dialog modal container (`role="dialog"`, overlay backdrop) replaced with standard Tab Shell panel layout (`role="region"` / tab panel container).
- DOM download helper extracted to `triggerDownload(blob, fileName)` in `src/lib/utils.ts` or as a localized helper.

### 5. Bridge Purge in `App.tsx` and `StemPlayer.tsx`

- `StemPlayer.tsx`: delete `ExportDialogState` export, `onExportDialogState` prop, `emitExportDialogState()` method, and the useEffect calling it.
- `App.tsx`: delete `exportDialogState` state variable and `handleExportDialogStateChange` handler. Pass snapshot/session facts directly to `<ExportTab />`.

## Testing Decisions

### Good Tests Focus on External Behavior

- Tests must exercise external behavior across defined module seams rather than mocking private internals.
- Audio encoding tests must verify that input samples and configurations yield valid output blobs with expected filenames, sample rates, channel counts, and anti-clipping scaling.
- UI tests must verify that user interaction events (mode selection, slider adjustments, preset clicks) correctly trigger the export engine with the expected parameters.

### Seams to Test

1. **Engine Seam (`src/__tests__/exportEngine.test.ts`)**:
   - Single stem WAV (16-bit, 24-bit) and MP3 export.
   - Full bundle ZIP packaging with 4 stems.
   - Bundle ZIP with Click Track inclusion and tempo stretch scaling.
   - Custom Mixdown with preset configurations and anti-clipping ceiling.
   - Offline time-stretch adjustments applied to stems.
   - Progress callbacks firing monotonically.
   - AbortSignal immediately aborting processing.
2. **UI Seam (`src/__tests__/ExportTab.test.tsx`)**:
   - Mode radio selection (Single Stem, Full Bundle, Custom Mixdown).
   - Preset buttons populating stem gain checkboxes/sliders.
   - Export button triggering `exportAudio` and calling download helper.
   - Disabled states when stems are unavailable.
   - Error toast display on failure.

### Prior Art

- `src/__tests__/customMixdown.test.ts`: pure mathematical tests on channel summing and peak limiting.
- `src/__tests__/bundleZip.test.ts`: testing ZIP packaging without DOM.
- `src/__tests__/stemPlayerEngine.test.ts`: commands in / snapshot out testing pattern.

## Out of Scope

- Modifying the underlying WAV or MP3 encoder algorithms (`wavEncoder.ts`, `mp3Encoder.ts`).
- Changing the Signalsmith Stretch WASM offline rendering engine (`renderOfflineStems`).
- Adding new audio export formats (e.g., FLAC, OGG, AAC) or sample rate conversion.
- Redesigning the visual styling or CSS classes of the Export Tab (must remain visually byte-identical to `view_target/stitch.html`).

## Further Notes

- The pre-commit gate chain (`check:glossary`, `check:doc-anchors`, `check:test-fixtures`, `check:testids`, `check:retired-affordances`, `check:dist-fresh`) will be verified on every commit.
- In accordance with the project navigation guidelines, any historical `data-testid` attributes will be preserved without modification.
