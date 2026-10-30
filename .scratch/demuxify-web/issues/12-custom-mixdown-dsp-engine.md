# 12: Audio Mixdown DSP Engine & Anti-Clipping Normalization

**What to build:** An audio mixdown engine that sums separated stems in memory with custom per-stem gains and master volume, protecting against digital clipping distortion with an intelligent peak normalizer (-0.3 dBFS safety ceiling). It also automatically resolves semantic filenames based on the active stem combination (e.g., karaoke, instrumental, acapella).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Sums multi-channel audio buffers across any combination of stems with individual linear gains and master gain.
- [x] Detects peak amplitude and scales the summed audio to -0.3 dBFS if the peak exceeds the ceiling when anti-clipping normalization is enabled.
- [x] Allows bypassing normalization when raw summed gain is explicitly requested.
- [x] Safely handles edge cases such as total silence or zero volume without producing NaN or division by zero errors.
- [x] Generates descriptive output filenames matching the selected stem combination (karaoke, instrumental, acapella, minus drums, or mixdown).
- [x] Verified with comprehensive unit tests for mathematical correctness, dynamic range headroom scaling, and naming logic.

## Answer

Implemented `src/lib/customMixdown.ts` with multi-channel direct memory summing across stems (`mixAudioStems`), per-stem and master linear gain scaling, intelligent peak amplitude detection, and automatic \(-0.3\text{ dBFS}\) anti-clipping normalization with optional bypass. Implemented stem combination taxonomy resolver (`resolveMixdownDescriptor`) and sanitized filename formatter (`formatMixdownFileName`). Verified with 11 comprehensive unit tests in `src/__tests__/customMixdown.test.ts`. All 205 suite tests pass cleanly.
