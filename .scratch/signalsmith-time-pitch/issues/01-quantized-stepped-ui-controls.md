# 01: Quantized Stepped UI Controls & Preset Grid

**What to build:** The Stem Player interface presents strictly quantized, musically meaningful controls for tempo and pitch. The tempo slider and inputs snap strictly to steps of `0.25x` within the range of `[0.50x, 2.00x]`, and the preset row displays all seven discrete speed options (`0.50x`, `0.75x`, `1.00x`, `1.25x`, `1.50x`, `1.75x`, `2.00x`). The pitch transposition slider and plus/minus buttons snap exclusively to whole semitone integers in the range `[-12, +12]` semitones. A dedicated reset action instantly restores both controls to their neutral defaults (1.00x and 0 st).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Playback tempo slider and numeric display are quantized to discrete steps of 0.25x between 0.50x and 2.00x.
- [x] Tempo preset button row contains exactly 7 buttons corresponding to each 0.25x interval (0.50x, 0.75x, 1.00x, 1.25x, 1.50x, 1.75x, 2.00x), highlighting the active preset when matched.
- [x] Pitch transposition slider and plus/minus buttons increment and decrement exclusively in whole integer semitones between -12 and +12 st.
- [x] Reset button restores tempo to 1.00x and pitch to 0 st, remaining disabled when both values are at neutral default.
- [x] Unit tests in the UI component test suite verify stepping behavior, preset selection, button increment/decrement clamping, and reset state.

## Answer

Quantized the tempo slider strictly to 0.25x steps (`min="0.5" max="2" step="0.25"`), rendered the full 7-preset grid (`0.50x` to `2.00x` in 0.25x intervals) with `aria-pressed` highlighting, locked pitch slider and steppers to whole integer semitones in `[-12, +12]`, and ensured the reset button activates whenever values deviate from neutral (1.00x, 0 st) and disables when at neutral default. Comprehensive test coverage added in `src/__tests__/stemPlayerTimeStretch.test.tsx`.

## Update (superseded by Ticket 05)

Tempo quantization was retuned from 0.25x to **0.05x** steps (`step="0.05"`, quantized via `Math.round(x * 20) / 20`) and minus/plus stepper buttons now flank the tempo slider. The 7-preset grid is unchanged (all presets are exact multiples of 0.05x). See `issues/05-tempo-pitch-decoupling-fix-and-005-tempo-steps.md`.
