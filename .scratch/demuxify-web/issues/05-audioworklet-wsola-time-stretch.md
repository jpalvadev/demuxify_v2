# 05: AudioWorklet WSOLA Engine for Real-Time Pitch & Tempo Time-Stretching

**What to build:** While listening to the Stem Player, the user adjusts playback tempo (0.5x to 2.0x) and pitch (-12 to +12 semitones); a dedicated AudioWorklet node running the WSOLA (Waveform Similarity Overlap-Add) algorithm processes all four Stems concurrently on the audio thread, delivering clean Time-Stretch without altering pitch when speed changes, and shifting pitch without altering playback speed.

**Blocked by:** 04: Multi-Track Stem Player with Synchronized Playback, Solo & Mute Controls

**Status:** resolved

- [x] Custom AudioWorkletProcessor implementing WSOLA time-scale modification across 4 parallel stereo Stems.
- [x] Pitch shifting engine allowing real-time transposition between -12 and +12 semitones independent of playback speed.
- [x] Tempo control allowing real-time speed adjustment between 0.5x and 2.0x without pitch shift.
- [x] UI controls in the Stem Player for tempo (slider and preset speed buttons) and pitch (semitone stepper / reset button).
- [x] Single-click reset to restore pitch to 0 semitones and tempo to 1.0x.
- [x] Inter-Stem phase preservation guaranteeing no comb-filtering or phasing artifacts across Stems during stretching.
- [x] Unit and integration tests testing AudioWorklet parameter messaging, buffer circular indexing, and WSOLA synthesis outputs.

## Answer
Implemented the AudioWorklet WSOLA real-time pitch and tempo time-stretching engine:
- `src/lib/wsolaProcessor.ts`: WSOLA engine operating across 4 stereo stems simultaneously with unified cross-correlation analysis to maintain inter-stem phase alignment. Independent tempo scaling (0.5x to 2.0x) and pitch shifting (-12 to +12 semitones).
- `src/lib/stemPlayerEngine.ts`: Connected WsolaProcessor to multi-track routing with subscriptions and graceful headless fallback.
- `src/components/StemPlayer.tsx`: Real-time controls with tempo slider, speed presets (0.75x, 1.0x, 1.25x, 1.5x), pitch stepper/slider with semitone badge, and reset button.
- Comprehensive test suite with 23 new tests (total 106 tests passing).

