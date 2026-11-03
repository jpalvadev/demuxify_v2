# 07: One Playhead, one clock — live spine mirror and the second readout's death

**What to build:** while the **Stems** play, every time-carrying surface agrees. The **Master Waveform** spine's playhead and its lime played-portion start moving on their own — press play with no mixer event at all and the spine walks. The spine, the four **Stem Strips** and the **Transport** readout show one and the same **Playhead** at every instant: the **Stem Player** gains one outbound channel (`onPlayheadChange(timeSec)`) fed by the engine's existing position subscription, and the app wires the spine to it. Domain-separate: the existing mixer-and-**Session** bridge keeps its own meaning and is never fired per frame, and the **Session** save cadence is untouched (a resumed **Session** lands at the last mixer position by design). Then the redundancy folds: the spine header's `mm:ss / mm:ss` group dies outright — the **Transport** becomes the Mix Tab's only visible clock — while the header keeps its label and its "Overview" chip and the canvas tick graduations survive as the time axis. Scrubbing the spine and then pressing play plays from the scrubbed position: one timeline gesture, one position.

**Blocked by:** 06 (ADR-0013 and the glossary vocabulary must exist first).

**Status:** ready-for-agent

- [ ] The one net-new regression test: press play, fire no mixer/seek event, and the spine slider's `aria-valuenow` walks off its start value — the screenshot's drift can never regress silently.
- [ ] Spine `aria-valuenow`/`aria-valuetext` stay exact against a moving **Playhead**; the spine's canvas repaint is time-gated near 15 draws/s while the position value itself keeps flowing — asserted only through value exactness, never frame counts.
- [ ] Scrubbed-then-played position plays: the spine stays the only scrub surface and the **Stem Strips** grow no scrubber of their own (existing keyboard-step, pointer-scrub and spine-absent-from-other-Tabs pins stay green untouched).
- [ ] The spine header's `mm:ss / mm:ss` group is absent at both the component seam and the composed whole-app Mix stage; the "Master Waveform" label and "Overview" chip survive (one surface, half retired); canvas tick graduations survive.
- [ ] Exactly one visible `mm:ss` readout in the Mix Tab — the **Transport**'s — and at 0.5×/2× it keeps counting canonical **Source Mix** seconds (the canonical-duration anchor survives).
- [ ] The anchor test's NAME is retargeted to say **Transport** (its zero-padded literal is the **Transport** face, and after this ticket the spine shows no duration at all); the pin itself stays green untouched.
- [ ] `npm run check:retired-affordances` gains the spine header readout marker so a second clock cannot come back in shipped code (tests and comments exempt as that rule already is).
- [ ] **Session** cadence untouched: the live bridge never drives auto-save; a resumed **Session** lands at the position the mixer events saved.
- [ ] Look is agent-authored: OpenDesign MCP answered nothing this session (documented dead-MCP fallback) — recorded here, no OpenDesign run paid (removals-and-re-home exception per `AGENTS.md`).
