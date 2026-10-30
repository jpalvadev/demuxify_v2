# 02: Signalsmith Stretch WebAssembly Adapter & Test Fallback

**What to build:** A modular audio processing adapter around the official WebAssembly build of Signalsmith Stretch. The adapter provides an interface to configure 4 synchronized stereo audio streams (one for each Stem: Vocals, Drums, Bass, Other), setting playback tempo ratios and semitone pitch shifts with sample-accurate time alignment. It supports selective Formant Preservation specifically on the Vocals stem while processing Drums, Bass, and Other without formant manipulation to protect transient attacks. A fallback layer detects environment capabilities so headless testing suites (Vitest/JSDOM) execute reliably without requiring native WASM worklet binaries.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Signalsmith Stretch library dependency is integrated into the web application build and audio pipeline.
- [x] Processing adapter exposes methods to initialize 4 stereo processing nodes for the 4 canonical Stems (Vocals, Drums, Bass, Other).
- [x] Adapter supports applying tempo ratios (`rate`) and pitch shifts in semitones (`semitones`), synchronizing sample processing across all active channels.
- [x] Selective vocal Formant Preservation (`formantCompensation: true`) is supported on the Vocals stem, with unpitched/direct processing on Drums, Bass, and Other.
- [x] Environment detection gracefully detects non-worklet or non-WASM execution environments (such as Vitest/JSDOM) and provides a mock/passthrough adapter to prevent test runner crashes.
- [x] Unit tests verify adapter lifecycle, parameter dispatching, and fallback detection.

## Answer

Implemented `src/lib/signalsmithStretchAdapter.ts` wrapping official `signalsmith-stretch` WebAssembly package with:

1. `isSignalsmithStretchSupported(audioContext)` detecting WebAssembly and AudioWorklet capabilities.
2. `createMultiTrackStretchAdapter` managing 4 synchronized stereo processing nodes (Vocals, Drums, Bass, Other).
3. Selective Vocal Formant Preservation: formant compensation (`formantCompensation: true`) is applied exclusively to the Vocals stem while Drums, Bass, and Other run in direct transient-preserving mode.
4. Robust `FallbackMultiTrackStretchAdapter` providing transparent test doubles and headless JSDOM/Vitest compatibility without native WASM worklet requirements.
5. Unit test coverage in `src/__tests__/signalsmithStretchAdapter.test.ts`.
