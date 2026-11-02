# 05: Export Bundle carries the Click Track as its own file

**What to build:** When the Click Track is enabled, the Export Bundle gains one separate Click Track file (WAV or MP3, matching the chosen Stems export format) — droppable on its own DAW lane. When disabled, the bundle is unchanged, and no Custom Mixdown preset ever contains clicks.

**Blocked by:** 04 (Click Track lane in the Stem Player — rail, synthesized clicks, Meter, stretch lock).

**Status:** ready-for-agent

- [ ] Export seam extended: enabled Click Track adds exactly one bundle member; its decoded beat intervals match the Beat Grid (~0.557 s median at 107.7 BPM on the reference track, within the stretch factor at export time).
- [ ] Disabled Click Track: bundle contents byte-for-byte as before (existing bundle test stays green unmodified).
- [ ] Format follows the Stems' export choice (WAV → WAV, MP3 → MP3) using the existing encoders; no new encoding path.
- [ ] Custom Mixdown presets (karaoke, instrumental, acapella, minus-drums) provably never sum the Click Track in — anti-clipping protection math untouched.
- [ ] Mixdown preset picker and dialog gain no Click Track affordance at all (the concept stays out of mixdowns, per ADR 0010).

## Comments
