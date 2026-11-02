# 04: Click Track lane in the Stem Player — rail, synthesized clicks, Meter, stretch lock

**What to build:** The Mix tab gains a Click Track rail (ported from the 01 artifact): toggle defaulting to **off**, mute/volume like a Stem lane, Meter selector 2/4/3/4/4/4/6/8 defaulting to 4/4. When enabled, a synthesized metronome plays locked to the Beat Grid — deeper accented downbeats, lighter other beats — and it speeds/slows in lockstep with Time-Stretch. It is not a Stem and never becomes one.

**Blocked by:** 01 (OpenDesign run — Click Track rail + Tempo readout look), 02 (Tempo Detector — automatic analysis at decode with Separate-tab readout).

**Status:** ready-for-agent

- [ ] Rail ported from the 01 OpenDesign artifact; run id + preview URL cited on this ticket; token architecture (HSL CSS variables) intact.
- [ ] Click Track state is parallel to Stem mixer state: `{ enabled (default off), muted, volume, meter }`; the `StemName` union stays `vocals | drums | bass | other` and `check:glossary` passes for the four new glossary terms.
- [ ] Click audio synthesized (no sampled assets): short exponentially-decaying bursts at Beat Grid positions in seconds, downbeat accent per Meter; deterministic from (Beat Grid, Meter); regenerated on Meter change only.
- [ ] Stem Player engine seam extended: click lane honors mute/volume; enabling/disabling never affects the four Stems' playback.
- [ ] Time-Stretch test pair extended: under any stretch factor, click intervals follow the Stems exactly — no independent rate control exists.
- [ ] Rubato check on the reference track: clicks land on Beat Grid positions (not a flat BPM re-derivation).
- [ ] Mix tab stays grayscaled until Stems exist; the rail only exists once Mix is live.

## Comments

- Design source: OpenDesign run recorded on ticket 01 (append run id + preview URL here once ported).
