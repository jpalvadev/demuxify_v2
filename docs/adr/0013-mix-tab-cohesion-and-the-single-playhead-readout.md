# Mix Tab cohesion and the single Playhead readout

Partially supersedes [ADR-0008](./0008-four-tab-shell-and-single-toggle-transport.md): the Transport stays a single **Play/Pause toggle** and the **Master Waveform** spine stays the timeline surface, but the Mix Tab's rail order and its two competing `mm:ss` readouts no longer apply. Recorded at porting start for the amendment "Mix Tab cohesion and the single Playhead readout" of `.scratch/mix-rail-tidy-up/spec.md` (tickets `06`–`10`); the look is agent-authored via the documented dead-OpenDesign fallback.

## Decision

**One Playhead, one clock, one readout, rails ordered the way the work is done.**

The **Playhead** is one value — canonical seconds of the **Source Mix**, invariant under **Time-Stretch** — and the spine, the four **Stem Strips** and the **Transport** readout show that same value at every instant. The **Stem Player** gains one outbound position channel, in the shape `onPlayheadChange(timeSec)`, fed by the engine's existing position subscription; the app wires the **Master Waveform** spine to it. The spine's canvas repaint is time-gated near fifteen draws per second while the position value keeps flowing every frame, so the assistive readout is never a stale approximation.

The **Transport** row owns the Mix Tab's only visible `mm:ss` readout. The spine header keeps its label and its "Overview" chip while its own `mm:ss / mm:ss` group dies outright; the canvas tick graduations survive because they are the time axis, not a position.

The rails read top-down in the order the work is done, one order at every breakpoint: spine → **Hand Calibration** tap lane → **Tempo Detector** candidate-picker **Rail** → **Transport** row → four **Stem Strips** → **Click Track Rail** → **Time-Stretch & Pitch-Shift**. The timeline neighbourhood gathers every surface that carries a time axis; the mixer block becomes five lanes with the **Click Track** last; rate and key come last. The candidate picker stops living inside the **Click Track Rail**: it becomes its own **Rail** — `role="group"` with its own accessible name, its four chips keeping their accessible names, `aria-pressed` lock state, confidence line and honest-ranking copy — rendered as the **Stem Player** section's first rail. No rail changes owner, no new component, no new seam, no mobile-specific Mix block.

## Why these trades

**Why exactly one `mm:ss` survives:** the drift symptom and the redundancy were one screenshot showing two bugs at once. Five **Playhead** renderings existed and only four agreed; a second clock made the disagreement legible, which is also what made it grieve. Fixing the channel without deleting a readout leaves redundancy; deleting a readout without the channel leaves a spine that still lies — both belong in one increment, and the live-mirror test (press play, no mixer event, the spine's `aria-valuenow` walks off its start) keeps the first from regressing silently.

**Why the Transport holds the clock instead of the spine:** the spine is a scrub surface — its whole job is the gesture against the time axis, and it already carries that axis as canvas graduations. The clock belongs to the transport that acts on a position, not to the surface you drag. Keeping the spine's readout and merely syncing both was rejected: two readouts of one value is a redundancy, not a feature, and the pair is exactly what made the lie visible.

**Why the picker is its own Rail and not a guest inside the Click Track lane:** a **Rail** means identity plus its own controls; the **Click Track**'s chips are not the lane's controls — they re-lock the **Beat Grid**, which is shared machinery the whole stage changes. A **Rail** that owns nothing but an on/off and a volume hosting four buttons betrays its own shape: the rail-shape pins assert zero buttons inside the lane root, so the relocation and the lane's shape assertion are one change, not two. Rendering it as the section's first rail is what keeps the chips physically out of the lane root while every pinned testid — picker, confidence line, readout — keeps resolving.

## Considered options

- Keep both readouts and sync them (rejected: redundancy; the disagreement was the symptom, the pair is the cause).
- Move the clock to the spine and drop the Transport's (rejected: the Transport is where position is acted on; the spine is the gesture surface).
- Per-frame mixer bridge reuse (rejected: the mixer-and-**Session** bridge keeps its own meaning and save cadence; a live bridge driving auto-save would churn persistence).
- Picker chips stay in the lane / move to app-level composition (rejected in both directions: the first betrays the lane's zero-button shape, the second would move ownership out of the component that already owns the picker — this is a placement increment, not a re-architecture).
- A mobile-specific Mix block to re-order on small screens (rejected outright: one order at every breakpoint, per ADR-0009's lesson that a drifting pair reintroduces the drift it removed).
