# 09: Stem Player Transport & WSOLA Pitch/Tempo Synchronization

**What to build:** The user scrubs (seeks), changes playback tempo (0.5x to 2.0x), and adjusts pitch (-12 to +12 semitones) in the Stem Player during active playback without audio desynchronization, ghost sources, or pitch/tempo coupling artifacts.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Seamless seeking (scrubbing) while playing: active `AudioBufferSourceNode`s or `AudioWorkletNode` are immediately repositioned and synchronized across all 4 Stems without audio sticking to old positions.
- [x] Dynamic tempo adjustments during playback preserve musical pitch independently without triggering tape-resampling pitch artifacts.
- [x] Dynamic pitch shifts during playback smoothly update through the WSOLA worklet engine without dropping or ignoring active Stems.
- [x] Robust fallback when AudioWorklet is unsupported or uninitialized, maintaining accurate transport seeking across normal sources.
- [x] TDD regression test suite in `src/__tests__/stemPlayerEngine.test.ts` verifying seek while playing, live tempo updates, live pitch updates, and playhead position integrity.
