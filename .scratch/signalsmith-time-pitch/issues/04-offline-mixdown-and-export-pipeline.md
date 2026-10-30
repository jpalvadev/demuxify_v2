# 04: Offline Time-Stretch & Pitch-Shift Export Pipeline

**What to build:** The export workflow incorporates an option to export individual Stems or the Custom Mixdown with active tempo and pitch settings applied. When the Export Dialog opens and active tempo diverges from 1.00x or pitch diverges from 0 st, a checkbox ("Apply active Pitch & Tempo adjustments") is displayed and checked by default. The export pipeline uses high-speed offline rendering to transform audio buffers according to the selected factors before packing into ZIP bundles or encoding as WAV/MP3 files.

**Blocked by:** 03 (Stem Player Multi-Track WASM Integration & Vocal Formant Toggle)

**Status:** resolved

- [x] Export Dialog detects when the current session has non-neutral tempo or pitch and displays an "Apply active Pitch & Tempo adjustments" checkbox with informative values (e.g. "+1 st, 1.25x").
- [x] Exporting with adjustments unchecked produces files at original unmodified speed and pitch (1.00x, 0 st).
- [x] Exporting with adjustments checked routes stem audio buffers through high-speed offline rendering using the Signalsmith Stretch engine.
- [x] Individual stem export (WAV/MP3 in ZIP bundle) and Custom Mixdown export both correctly reflect the applied tempo and pitch transformation.
- [x] Unit tests verify Export Dialog toggle behavior and offline rendering pipeline parameter passing.

## Answer

Implemented the offline export pipeline and UI integration:

1. Extended `ExportDialog` to accept `activeTempo`, `activePitch`, and `activeFormantPreservation`.
2. Automatically detects non-neutral sessions and surfaces an "Apply active Pitch & Tempo adjustments" checkbox with informative values (e.g., `+2 st, 1.25x`), defaulted to checked.
3. Implemented `renderOfflineStems` in `src/lib/signalsmithStretchAdapter.ts` to transform all stem audio channels offline via high-speed Signalsmith Stretch or sample-accurate fallback.
4. Integrated into Single Stem export, Full Bundle ZIP export, and Custom Mixdown export.
5. Added unit and component tests in `src/__tests__/ExportDialog.test.tsx`.
