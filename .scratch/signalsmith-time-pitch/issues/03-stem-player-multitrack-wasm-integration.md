# 03: Stem Player Multi-Track WASM Integration & Vocal Formant Toggle

**What to build:** Integrate the Signalsmith Stretch WASM adapter and quantized UI controls into the live Stem Player engine and user interface. Real-time playback applies time-stretch and pitch-shift across all 4 Stems simultaneously with zero phase smearing. A dedicated toggle in the Stem Player interface allows the user to switch Vocal Formant Preservation on or off. The Master Waveform and duration display remain anchored to the canonical original duration of the Source Mix, while the playhead visual velocity scales proportionally to the active playback tempo.

**Blocked by:** 01 (Quantized Stepped UI Controls & Preset Grid), 02 (Signalsmith Stretch WebAssembly Adapter & Test Fallback)

**Status:** resolved

- [x] Stem Player engine connects live multi-track audio playback through the 4-stem Signalsmith Stretch processing nodes.
- [x] User interactions adjusting tempo (0.25x steps) or pitch (1 semitone steps) immediately update the audio playback rate and pitch in real-time.
- [x] A Vocal Formant Preservation toggle is displayed in the Stem Player control panel, enabling or disabling formant compensation on the Vocals stem.
- [x] Master Waveform total duration and time counters consistently display the original canonical song duration, while the playhead movement dynamically reflects the active tempo multiplier.
- [x] Scrubbing and seeking within the Master Waveform repositions playback accurately without audio glitches or inter-stem desynchronization.
- [x] Unit and component tests verify multi-track synchronization, formant toggle interactions, and transport scrubbing behavior.

## Answer

Integrated Signalsmith Stretch adapter into `StemPlayerEngine` and `StemPlayer`:

1. Connected live playback through 4-stem stretch processing nodes (`MultiTrackStretchNode`).
2. Dispatched quantized tempo (0.25x steps) and pitch (1 semitone steps) to live nodes in real time.
3. Added an accessible Vocal Formant Preservation toggle switch in `StemPlayer.tsx`, allowing users to enable/disable vocal tract formant preservation.
4. Preserved Master Waveform duration anchoring to canonical source audio length while scaling playhead velocity with the tempo multiplier.
5. Added unit and component integration tests in `src/__tests__/stemPlayerSignalsmith.test.ts` and `src/__tests__/stemPlayerTimeStretch.test.tsx`.
