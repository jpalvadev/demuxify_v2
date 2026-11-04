# 02: Mix stage re-composition — mockup order, canvas palette, drop list

**What to build:** the **Mix Tab** restaged in the mockup's order and wearing the new language at the desktop breakpoint (mobile stacking is ticket 06). All shipped behaviors keep working through the re-composition; nothing here adds behavior except the one honest reset button.

**Blocked by:** 01 (tokens/fonts/Tab Band).

**Status:** resolved

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

- [x] Stage order above renders at md+; ADR-0013's rail-order claims superseded by ADR-0014 (authored ticket 07).
- [x] Canvas color constants retargeted in the waveform/stem modules (math untouched; Beat Grid snap tolerance untouched — do not touch `src/lib/beatGridRepair.ts`).
- [x] Transport full-bleed last rail; Play/Pause toggle coral circle; timecode + volume readouts survive.
- [x] Candidate row with confidence + lock; `aria-pressed` survives.
- [x] Every pinned testid from the old composition resolves in the new one (`check:testids`); Mix-stage class asserts in the app test retargeted in the same commit.
- [x] Drop list absent from source and DOM; suite green through the chain.

## Comments

### Port record - Stitch skin (agent-authored design)

- Design source: spec mockup (`stitch-skin/spec.md`, Mix Tab stage order + transport
  cell). The OpenDesign MCP was deliberately not called this effort; this agent-
  authored design is the recorded fallback source.
- Landed as one gated commit on branch `stitch-skin` (chain green at commit time).
- Canvas (math untouched): waveform box `hsl(240 13% 4.5%)` = `#0a0a0d`; played
  trace electric lime `hsl(95 100% 54%)` = `#39ff14`; playhead `#ffffff` with
  `shadowBlur = 8` glow stroke; cap triangle white. Graduations/mono labels
  survive; no spine clock (ADR-0013 keeps the mm:ss group dead on the spine).
- Spine header: `Stereo Mix` coral nameplate pill (`rounded-full bg-st-coral
text-primary-foreground` 9px uppercase) added beside the shipped `Master
Waveform` title, and the `Overview` chip got the chip scale (`rounded-full
bg-st-surface border border-st-hairline`, 9px uppercase). The spec's single-
  nameplate form was NOT possible: `MasterWaveform.test.tsx` pins both
  `getByText("Master Waveform")` and `getByText("Overview")` - keep-both form.
- Candidate picker (`click-track-candidate-picker`): `grid grid-cols-2` ->
  `grid grid-cols-1 md:grid-cols-4 gap-1`; confidence readout + lock chip
  untouched, `aria-pressed` survives.
- Transport: Play/Pause button became the mockup's coral circle (`h-11 w-11
rounded-full`, `px-5` dropped, `relative` for the caption); it keeps
  `aria-label="Play/Pause"` + `aria-pressed` so the `/^play\/pause$/i` pin
  stays green. Honest status caption added inside the transport cell below
  the circle: `aria-hidden`, `hidden sm:flex`, emerald pip (`bg-st-ok`) +
  `4 STEMS · PHASE-LOCKED` when `beatGrid` is latched, else `4 STEMS
· PHASE OPEN`; no `SYNC READY` claim anywhere (grep-verified).
- Order deviation record: the mockup's stage order (spine -> tap lane ->
  candidates -> transport -> strips) is already the shipped ADR-0013 order
  with the transport at rail position 4 - no permutation was performed
  (permuting would have broken ADR-0013's cohesion pins); `Transport last`
  reads as the last full-width rail of the upper block, verified in place.
- Volume rail: `hidden lg:flex` -> always-shown rail; slider input `w-24` ->
  `flex-1 min-w-[96px]`; `100%` readout and `mm:ss / mm:ss` timecode survive.
- StemStrip.tsx activeColors retargeted to the Stitch stem hexes (Vocals
  `#c084fc`, Drums `#818cf8`, Bass `#f59e0b`, Other `#22d3ee`); waveform paint
  math untouched.
- Drop list grep-verified absent from rendered source: undo/redo, gear, loop,
  seek-to-start, fast-forward, TAP, VU/0 dB, 4/4 Beat, beat-dot/BAR, Click-lane
  M. `Reset Pitch & Tempo` was already shipped (ticket 08) - not re-added.
- Suite retargets: no Mix-stage assertion pinned `grz-*` or `rounded-none`
  beyond the ticket-01 global sweep; no testid moved, so `check:testids`
  resolves without edits.
