# 02: Mix stage re-composition — mockup order, canvas palette, drop list

**What to build:** the **Mix Tab** restaged in the mockup's order and wearing the new language at the desktop breakpoint (mobile stacking is ticket 06). All shipped behaviors keep working through the re-composition; nothing here adds behavior except the one honest reset button.

**Blocked by:** 01 (tokens/fonts/Tab Band).

**Status:** ready-for-agent

## Design source (agent-authored fallback; palette per ticket 01)

Stage order (mockup, top to bottom — the ADR-0013 order is superseded by this):

1. **Master Waveform** spine card: `MASTER WAVEFORM` label + "Overview" caption + `STEREO MIX` chip; waveform box `#0a0a0d`, trace electric lime `#39ff14` (was acid-lime), `mm:ss` graduations survive, white Playhead with glow; **no spine clock**.
2. **Hand Calibration** thin lane welded under the spine: shipped copy ("Tap 4 beats on the groove…") + coral Confirm chip + "Reset taps" chip; no duplicated header buttons.
3. **BPM Candidate** chips row: top reading + ranked alternatives with confidence + lock chip (`aria-pressed` survives); `grid grid-cols-1 md:grid-cols-4`.
4. **Transport** as the stage's **last rail**, full-bleed, **Stem Player** keeps ownership: timecode block `mm:ss / mm:ss`, coral-circle Play/Pause toggle, Master Volume slider + `100%` readout, honest status line `4 STEMS · PHASE-LOCKED` with ok pip only when Stems exist. The mockup's `SYNC READY` claim dies — honest line only.
5. Four **Stem Strips**: stem dot + name + ISO-N chip + waveform (Vocals `#c084fc`, Drums `#818cf8`, Bass `#f59e0b`, Other `#22d3ee`) with per-strip Playhead + M/S square chips + volume slider rack.
6. **Click Track** card: ♪ switch + volume slider + honest BPM line only — no Click-lane mute (dead per ADR-0013's parent), no invented claims.
7. **Time-Stretch** card: slider + six preset chips + `1.00x` readout.
8. **Pitch-Shift** card: slider + **Formant Preservation** chip + **Reset Pitch & Tempo** button — the only added control, honest reset to 1.00x/0 st.

Drop list — never rendered anywhere (revival-banned in the sweep): undo/redo, gear, engine badge (`DSP·LATENCY·BUFFERS`), Loop toggle, ⏮/Seek-to-start, ⏭/fast-forward, Transport `TAP` button, VU "0 dB" meters, "4/4 Beat", beat-dot/BAR readout, Click-lane M.

Keep-dead (guardrail-retired, mockup may suggest otherwise — it stays dead): Meter "4/4 Beat", Downbeat-phase beat dots/BAR readout.

## Checklist

- [ ] Stage order above renders at md+; ADR-0013's rail-order claims superseded by ADR-0014 (authored ticket 07).
- [ ] Canvas color constants retargeted in the waveform/stem modules (math untouched; Beat Grid snap tolerance untouched — do not touch `src/lib/beatGridRepair.ts`).
- [ ] Transport full-bleed last rail; Play/Pause toggle coral circle; timecode + volume readouts survive.
- [ ] Candidate row with confidence + lock; `aria-pressed` survives.
- [ ] Every pinned testid from the old composition resolves in the new one (`check:testids`); Mix-stage class asserts in the app test retargeted in the same commit.
- [ ] Drop list absent from source and DOM; suite green through the chain.

## Comments
