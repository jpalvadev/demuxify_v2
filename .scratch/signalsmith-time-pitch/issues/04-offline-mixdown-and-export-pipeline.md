# 04: Offline Time-Stretch & Pitch-Shift Export Pipeline

**What to build:** The export workflow incorporates an option to export individual Stems or the Custom Mixdown with active tempo and pitch settings applied. When the Export Dialog opens and active tempo diverges from 1.00x or pitch diverges from 0 st, a checkbox ("Apply active Pitch & Tempo adjustments") is displayed and checked by default. The export pipeline uses high-speed offline rendering to transform audio buffers according to the selected factors before packing into ZIP bundles or encoding as WAV/MP3 files.

**Blocked by:** 03 (Stem Player Multi-Track WASM Integration & Vocal Formant Toggle)

**Status:** ready-for-agent

- [ ] Export Dialog detects when the current session has non-neutral tempo or pitch and displays an "Apply active Pitch & Tempo adjustments" checkbox with informative values (e.g. "+1 st, 1.25x").
- [ ] Exporting with adjustments unchecked produces files at original unmodified speed and pitch (1.00x, 0 st).
- [ ] Exporting with adjustments checked routes stem audio buffers through high-speed offline rendering using the Signalsmith Stretch engine.
- [ ] Individual stem export (WAV/MP3 in ZIP bundle) and Custom Mixdown export both correctly reflect the applied tempo and pitch transformation.
- [ ] Unit tests verify Export Dialog toggle behavior and offline rendering pipeline parameter passing.
