# The Export Engine Speaks Commands and Renders One Export Payload

Extends [ADR-0004](./0004-client-side-stem-mixdown-and-anti-clipping.md) (Custom Mixdown anti-clipping ceiling), [ADR-0007](./0007-tab-shell-ui.md) (Tab Shell UI), [ADR-0010](./0010-client-side-tempo-detection-and-click-track.md) (Click Track lane inclusion), and [ADR-0016](./0016-the-player-engine-speaks-commands-and-reports-one-mixer-state.md) (Player Engine commands in, snapshot out).

## Context

Prior to this decision, audio export orchestration was tangled inside an 1,137-line UI component (`ExportDialog.tsx`). Despite ADR-0007 and ADR-0014 establishing the four-tab shell where Export is a permanent, inline tool surface, the component carried historical "Dialog" nomenclature, dead modal props (`isOpen`, `onClose`), and dialog ARIA roles.

More critically, the UI component acted as an ad-hoc audio processing engine. Inside React button click handlers and render loops, it directly managed offline time-stretching (`renderOfflineStems`), Click Track pulse synthesis, Custom Mixdown summing and anti-clipping, WAV/MP3 encoders (`encodeWav`, `encodeMp3`), and ZIP bundle packaging (`createStemBundleZip`). Testing export required rendering a 1,000-line React component tree in jsdom, clicking radio buttons, and mocking browser DOM anchors.

Furthermore, state plumbing was leaky: previously, `src/components/StemPlayer.tsx` synthesized a now-retired `ExportDialogState` payload and pushed it up to `src/App.tsx` via deleted `onExportDialogState`, which `App.tsx` stored in component state and passed back down as loose props. Now that ADR-0016 has established the unified `StemPlayerSnapshot`, this intermediate bridge was redundant plumbing.

## Decision

The export subsystem collapses into a deep headless **Export Engine** module and a thin, focused **Export Tab** view:

1. **Headless Export Engine (`src/lib/exportEngine.ts`):**
   - Presents a single unified entry point: `exportAudio(request, context, options): Promise<ExportResult>`.
   - Discriminated request union (`ExportRequest`) supports `'single'`, `'bundle'`, and `'mixdown'` modes:
     - `SingleStemExportRequest`: `{ mode: "single", stem: StemName, format: ExportFormat, bitDepth?: 16 | 24, bitrate?: Mp3Bitrate, applyAdjustments?: boolean }`
     - `BundleExportRequest`: `{ mode: "bundle", format: ExportFormat, bitDepth?: 16 | 24, bitrate?: Mp3Bitrate, applyAdjustments?: boolean, includeClickTrack?: boolean }`
     - `MixdownExportRequest`: `{ mode: "mixdown", format: ExportFormat, bitDepth?: 16 | 24, bitrate?: Mp3Bitrate, applyAdjustments?: boolean, stemGains: Record<StemName, number>, masterGain: number, antiClipping: boolean, preferInstrumental?: boolean }`
   - Pure headless output: returns `{ blob: Blob, fileName: string, mimeType: string, descriptor?: MixdownDescriptor }`.
   - Coordinates offline Time-Stretch rendering, Custom Mixdown anti-clipping gain (-0.3 dBFS safety ceiling via `mixAudioStems`), Click Track synthesis, WAV/MP3 encoders, and ZIP packaging behind this single seam.

2. **Standard Cancellation via `AbortSignal`:**
   - Cancellation is governed through standard Web API `AbortSignal` (`options.signal?: AbortSignal`).
   - Aborting mid-flight halts worker encoding loops and offline rendering immediately, rejecting cleanly with an `AbortError` without producing partial files or unhandled rejections.

3. **Isolated Browser Download Adapter (`src/lib/utils.ts`):**
   - DOM side-effects are extracted into `triggerDownload(blob, fileName)`.
   - `exportAudio` produces pure data; the UI view invokes `triggerDownload` upon completion.

4. **Clean Export Tab View (`src/components/ExportTab.tsx`):**
   - Renamed from `ExportDialog.tsx` to `ExportTab.tsx`, exporting `ExportTab`.
   - Dead modal affordances (`isOpen`, `onClose`, modal overlay backdrop, Escape key listener) are deleted; container renders as a clean Tab panel (`role="region"`).
   - In-panel Cancel button triggers an internal `AbortController` linked to the active export, cleanly resetting state without throwing unhandled errors.

5. **The Bridge Purge in `StemPlayer.tsx` and `App.tsx`:**
   - Redundant intermediate bridge `ExportDialogState` interface, `onExportDialogState` prop, and `emitExportDialogState()` method are deleted and retired from `src/components/StemPlayer.tsx`.
   - Redundant state variable `exportDialogState` and handler `handleExportDialogStateChange` are deleted and retired from `src/App.tsx`.
   - `App.tsx` renders `<ExportTab />` directly with facts derived from the active `StemPlayerSnapshot`, session, and tempo analysis.

6. **Domain Relocations:**
   - `MIXDOWN_PRESETS` and `computeInitialStemControls` relocate from React components to domain modules (`src/lib/customMixdown.ts` / `src/lib/exportEngine.ts`).

## Considered Options

- **Keep export math in ExportTab** (rejected: prevents headless unit testing, couples audio encoding algorithms to React rendering lifecycle).
- **Keep ExportDialogState bridge in StemPlayer and App** (rejected: duplicates mixer state already captured authoritatively in `StemPlayerSnapshot`).
- **Callback-based cancellation** (rejected: ad-hoc ref flags are fragile; standard `AbortSignal` integrates cleanly with Promise concurrency and aborts immediately).
- **Direct window.open for downloads** (rejected: popup blockers intercept dynamic data blobs; programmatic `triggerDownload` remains the robust approach).

## Consequences

- Audio math, bit-depth conversions, MP3 encoding, and ZIP bundle packaging are tested in milliseconds in pure Node/Vitest (`src/__tests__/exportEngine.test.ts`) without mounting React components.
- The Export Tab component suite (`src/__tests__/ExportTab.test.tsx`) focuses strictly on user interactions and form controls.
- The historical "Dialog" nomenclature is retired across code and tests, adhering strictly to ADR-0007 and `GLOSSARY.md`.
- All pre-commit guardrails (`check:glossary`, `check:doc-anchors`, `check:test-fixtures`, `check:testids`, `check:retired-affordances`, `check:dist-fresh`) pass cleanly.
