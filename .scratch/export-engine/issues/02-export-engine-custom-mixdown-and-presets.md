# 02: Custom Mixdown & Preset Resolution in the Export Engine

**What to build:** Extend `exportAudio` with full Custom Mixdown support (`mode: "mixdown"`), allowing users to export a single summed WAV or MP3 audio file from arbitrary combinations of stems and custom gain levels. The engine calculates anti-clipping headroom (guaranteeing ADR-0004's -0.3 dB safety ceiling) and determines the semantic descriptor (`acapella`, `karaoke`, `instrumental`, `minus_drums`, `mixdown`). Standard presets and initial stem control mapping are relocated from UI files to domain modules so they can be reused across the application.

**Blocked by:** 01: The Headless Export Engine — Single Stem & Full Bundle.

**Status:** resolved

- [x] `exportAudio` accepts `MixdownExportRequest` (`mode: "mixdown"`) and renders a single summed audio `Blob` in WAV or MP3 format.
- [x] Anti-clipping protection detects peak amplitudes exceeding the -0.3 dB ceiling (~0.966 linear) and normalizes the summed audio cleanly.
- [x] Semantic descriptor resolution and filename formatting produce expected names (`<Title>_<descriptor>.<ext>`) with `preferInstrumental` support.
- [x] Active Time-Stretch and pitch adjustments apply offline to the enabled mixdown stems before channel summing.
- [x] `MIXDOWN_PRESETS` and `computeInitialStemControls` are housed in domain modules (`customMixdown.ts` / `exportEngine.ts`) rather than exported from React components.
- [x] Headless unit tests in `src/__tests__/exportEngine.test.ts` verify mixdown channel summing, anti-clipping scaling, descriptor resolution, and cancellation without DOM.
