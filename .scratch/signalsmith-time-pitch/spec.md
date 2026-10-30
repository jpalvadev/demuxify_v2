# Spec: High-Fidelity WASM Time-Stretch & Pitch-Shifting Engine

Status: ready-for-agent

## Problem Statement

Musicians, vocalists, and audio producers frequently need to shift playback tempo (_Time-Stretch_) and transpose key (_Pitch-Shift_) to practice at manageable speeds or adapt material to specific vocal ranges. In client-side music players, existing time-domain algorithms like WSOLA introduce severe acoustic degradation on polyphonic material, including metallic ringing, flanging, chorus artifacts, and loss of phase coherence across stems. Furthermore, shifting pitch without compensating for vocal tract resonances produces unnatural "chipmunk" or cavernous voice distortions on the vocal track. Users also lack clean, musical stepped controls to increment or decrement in exact semitones or standard tempo intervals, and cannot export their custom mixes reflecting these tempo and pitch adjustments.

## Solution

Integrate a state-of-the-art WebAssembly frequency-domain audio processing engine based on Signalsmith Stretch inside the browser audio pipeline. The engine processes all 4 Stems simultaneously with sample-accurate phase synchronization, enables Formant Preservation specifically on the Vocals stem to keep singing voices natural across pitch changes, and quantizes player controls to strict discrete musical steps: exact 1-semitone intervals for pitch transposition (-12 to +12 st) and 0.25x intervals for playback tempo (0.50x to 2.00x). In addition, the export workflow provides an explicit option to export individual stems or the Custom Mixdown with the active pitch and tempo modifications rendered offline at high speed.

## User Stories

1. As a singer practicing a song, I want to shift the playback pitch in discrete steps of 1 semitone, so that I can match my comfortable vocal tessitura without accidental microtonal detuning.
2. As an instrumentalist practicing a difficult musical passage, I want to adjust the playback speed in discrete steps of 0.25x (0.50x, 0.75x, 1.00x, 1.25x, 1.50x, 1.75x, 2.00x), so that I can systematically build up technical proficiency.
3. As a vocalist listening to transposed audio, I want the Vocals stem to have Formant Preservation enabled, so that vocal timbre remains natural and does not sound like a chipmunk when transposed upwards or cavernous when transposed downwards.
4. As a drummer or percussionist, I want the Drums stem to bypass formant analysis, so that sharp transients, snare cracks, and kick attacks remain crisp without softening or phase smearing.
5. As a bassist listening to transposed audio, I want the Bass stem to preserve its low-end clarity and tight attack without unnecessary spectral distortion.
6. As a Stem Player user, I want direct preset buttons for all 7 tempo values (`0.50x`, `0.75x`, `1.00x`, `1.25x`, `1.50x`, `1.75x`, `2.00x`), so that I can switch instantly to common practice tempos with a single click.
7. As a Stem Player user, I want quick plus (`+`) and minus (`-`) buttons next to the pitch control, so that I can increment or decrement by exactly 1 semitone per click.
8. As a Stem Player user, I want a "Reset Pitch & Tempo" action that restores both parameters immediately to 1.00x and 0 semitones, so that I can return to the original mix reference with one click.
9. As a user adjusting pitch or tempo, I want a toggle switch to enable or disable vocal formant preservation, so that I can choose between natural acoustic timbre or the classic pitched-tape effect.
10. As a Stem Player user, I want all 4 Stems (Vocals, Drums, Bass, Other) to play in perfect inter-stem synchronization without comb filtering or drift when time-stretch or pitch-shift is active.
11. As a user navigating playback, I want the Master Waveform and timeline counters to remain anchored to the canonical duration of the original Source Mix, so that song sections and bar positions remain predictable regardless of playback speed.
12. As a user observing the playback cursor, I want the playhead to glide across the Master Waveform at a speed proportional to the active tempo, so that visual playback feedback matches the auditory tempo.
13. As a user creating a backing track or rehearsal file, I want the Export Dialog to detect if tempo or pitch has been modified and offer a toggle to export with active adjustments applied, so that I can download audio in my desired key and speed.
14. As a user exporting unedited master stems, I want to uncheck the adjustments option in the Export Dialog to download the clean original stems at 1.00x and 0 st even when the live player is transposed.
15. As a user whose browser restricts WebAssembly or modern worklets, I want the system to detect missing capabilities and provide a graceful fallback, so that playback remains functional without crashing.
16. As a software developer running unit and regression tests, I want the test suite to execute rapidly and reliably in Vitest and JSDOM environments without requiring host-specific native binaries.

## Implementation Decisions

### 1. High-Fidelity Audio Processing Engine

- Migrate the live time-scale and pitch modification pipeline from time-domain WSOLA to the official WebAssembly release of Signalsmith Stretch.
- Instantiate four synchronized stereo processing pipelines corresponding to the four isolated stems (Vocals, Drums, Bass, Other).
- Enable formant compensation on the pipeline assigned to the Vocals stem to maintain vocal tract characteristics across transposition. Leave Drums, Bass, and Other pipelines in direct mode without formant analysis to eliminate computational overhead and protect transient attacks.
- Feed identical timestamp and audio frame boundaries across all four processing instances to prevent phase drift between channels.

### 2. Stepped UI and Quantized Interaction Architecture

- Restrict playback tempo controls strictly to steps of `0.25x` within the range of `[0.50x, 2.00x]`.
- Provide a preset button row displaying all seven discrete steps: `0.50x`, `0.75x`, `1.00x`, `1.25x`, `1.50x`, `1.75x`, and `2.00x`.
- Restrict pitch controls strictly to integer semitone steps of `1 st` within the range of `[-12, +12]` semitones.
- Add an accessible toggle control in the transposition section to allow the user to enable or disable vocal formant preservation on demand.
- Ensure the Master Waveform time markers and duration displays represent canonical source duration, while the playhead speed scales dynamically with the active tempo multiplier.

### 3. Offline Export and Custom Mixdown Integration

- Extend the export dialog to inspect active session pitch and tempo values upon opening.
- Present a checkbox ("Apply active Pitch & Tempo adjustments") that defaults to checked whenever tempo is not 1.00x or pitch is not 0 st.
- Integrate an offline rendering pass utilizing an offline audio context to apply high-speed non-real-time stretching and pitch-shifting to both individual stem exports and the summed Custom Mixdown.

### 4. Compatibility and Test Environment Adapter

- Implement an environment detection wrapper that verifies WebAssembly and AudioWorklet availability before instantiating the WASM processor.
- Provide a test-safe adapter that emulates processing lifecycle methods when executing in headless test environments (such as Vitest and JSDOM), avoiding test failures in environments without native WASM AudioWorklet support.

## Testing Decisions

### Good Test Philosophy

Tests must strictly verify observable external behavior and public contracts:

- Verification that user interactions with the tempo slider or preset buttons update playback rate to exact multiples of 0.25x.
- Verification that pitch adjustments increment/decrement exclusively in whole semitones without fractional floating-point noise.
- Verification that the formant compensation toggle dispatches the appropriate state change to the audio engine.
- Verification that the export dialog surfaces the adjustment option when values diverge from default, and routes export requests with the expected transform parameters.
- Avoid coupling tests to internal WASM memory pointer manipulations or private worklet message schemas.

### Tested Seams

- **UI Component Seam (`StemPlayer` & `ExportDialog`)**: Rendered via testing library to simulate user clicks, slider drags, preset button presses, and export confirmation.
- **Engine Control Seam (`StemPlayerEngine`)**: Direct invocations of public methods to set tempo, pitch, formant preservation, and verify state emissions and duration calculations.
- **Export Mixdown Seam (`customMixdown`)**: Verifying that mixdown rendering accepts time-stretch and pitch-shift parameters and outputs valid multi-channel audio data.

### Prior Art

- `src/__tests__/StemPlayer.test.tsx` and `src/__tests__/stemPlayerEngine.test.ts` for transport and multi-track audio control testing.
- `src/__tests__/ExportDialog.test.tsx` and `src/__tests__/customMixdown.test.ts` for export configuration and offline mixdown validation.

## Out of Scope

- Fractional cent / microtonal pitch shifting (deliberately locked to 1-semitone musical steps).
- Per-stem independent tempo or pitch settings (all stems share the global session pitch and tempo).
- Cloud-based audio processing (all operations remain strictly client-side).

## Further Notes

- Aligns with terminology defined in `GLOSSARY.md` (_Source Mix_, _Stem_, _Stem Player_, _Time-Stretch_, _Pitch-Shift_, _Formant Preservation_, _Master Waveform_, _Custom Mixdown_).
- Formal architecture decision recorded in `docs/adr/0006-signalsmith-stretch-wasm-time-pitch.md`.
