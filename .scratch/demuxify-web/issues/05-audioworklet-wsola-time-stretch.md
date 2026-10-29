# 05: AudioWorklet WSOLA Engine for Real-Time Pitch & Tempo Time-Stretching

**What to build:** While listening to the Stem Player, the user adjusts playback tempo (0.5x to 2.0x) and pitch (-12 to +12 semitones); a dedicated AudioWorklet node running the WSOLA (Waveform Similarity Overlap-Add) algorithm processes all four Stems concurrently on the audio thread, delivering clean Time-Stretch without altering pitch when speed changes, and shifting pitch without altering playback speed.

**Blocked by:** 04: Multi-Track Stem Player with Synchronized Playback, Solo & Mute Controls

**Status:** ready-for-agent

- [ ] Custom AudioWorkletProcessor implementing WSOLA time-scale modification across 4 parallel stereo Stems.
- [ ] Pitch shifting engine allowing real-time transposition between -12 and +12 semitones independent of playback speed.
- [ ] Tempo control allowing real-time speed adjustment between 0.5x and 2.0x without pitch shift.
- [ ] UI controls in the Stem Player for tempo (slider and preset speed buttons) and pitch (semitone stepper / reset button).
- [ ] Single-click reset to restore pitch to 0 semitones and tempo to 1.0x.
- [ ] Inter-Stem phase preservation guaranteeing no comb-filtering or phasing artifacts across Stems during stretching.
- [ ] Unit and integration tests testing AudioWorklet parameter messaging, buffer circular indexing, and WSOLA synthesis outputs.

