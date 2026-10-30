# 01: Quantized Stepped UI Controls & Preset Grid

**What to build:** The Stem Player interface presents strictly quantized, musically meaningful controls for tempo and pitch. The tempo slider and inputs snap strictly to steps of `0.25x` within the range of `[0.50x, 2.00x]`, and the preset row displays all seven discrete speed options (`0.50x`, `0.75x`, `1.00x`, `1.25x`, `1.50x`, `1.75x`, `2.00x`). The pitch transposition slider and plus/minus buttons snap exclusively to whole semitone integers in the range `[-12, +12]` semitones. A dedicated reset action instantly restores both controls to their neutral defaults (1.00x and 0 st).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Playback tempo slider and numeric display are quantized to discrete steps of 0.25x between 0.50x and 2.00x.
- [ ] Tempo preset button row contains exactly 7 buttons corresponding to each 0.25x interval (0.50x, 0.75x, 1.00x, 1.25x, 1.50x, 1.75x, 2.00x), highlighting the active preset when matched.
- [ ] Pitch transposition slider and plus/minus buttons increment and decrement exclusively in whole integer semitones between -12 and +12 st.
- [ ] Reset button restores tempo to 1.00x and pitch to 0 st, remaining disabled when both values are at neutral default.
- [ ] Unit tests in the UI component test suite verify stepping behavior, preset selection, button increment/decrement clamping, and reset state.
