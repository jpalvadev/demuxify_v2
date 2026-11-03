# Spec: Mix Rail Tidy-Up — Mobile Container Flattening, Formant Chip Button, Click Track Mute Death, Solo/Mute Exclusivity

Status: resolved-in-full (tickets `01`–`05` all resolved). Carries one **Amendment** below: "Mix Tab cohesion and the single Playhead readout" — **resolved-in-full** (tickets `06`–`10` all resolved).

Recorded on the tracker 2026-11-02. Supersedes nothing outright: it amends the Click Track lane state recorded in `docs/adr/0010-client-side-tempo-detection-and-click-track.md`, and an ADR-0012 "Solo and Mute are per-Stem exclusive" is authored with this increment; an ADR-0009-style removals-and-re-home exception applies (no OpenDesign run). Glossary terms used throughout: **Stem Player**, **Stems**, **Click Track**, **Beat Grid**, **Session**, **Export Bundle**, **Time-Stretch**, **Pitch-Shift**, **Formant Preservation**, **Tab Shell**, **Tab**, **Master Waveform**, **Transport**.

## Problem Statement

On mobile portrait, the Mix **Tab** stage of the **Stem Player** fights itself with frames and broken affordances, and two mixer controls misbehave:

1. **Too many nested containers.** The stage paints border-inside-border-inside-border: the Tab Shell stage panel wraps the Stem Player's own bordered card, which wraps the Time-Stretch panel's border, which wraps two more bordered sub-boxes (Tempo/Speed and Pitch Transposition). Four stacked hairlines on a 390 px viewport read as noise.
2. **The Vocal Formant Preservation toggle is mispositioned.** A shadcn-style pill-slider with a sliding white knob sits pinned bottom-right of the Pitch Transposition box; on mobile its knob overhangs the panel border, half outside the card.
3. **The Click Track rail has redundant buttons.** It carries both a ♪ on/off switch and a separate "M" mute, plus a volume fader. Off already means silence; the mute duplicates it.
4. **Stems let you press Mute (M) and Solo (S) together** on the same lane, and the engine treats solo+muted as gain 0 — pressing both silences the **entire mix**, a state the user can strike but never wants.

## Solution

Four coordinated decisions, all settled in a grilling session:

- **Flatten the containers below `md` (768 px)**: the Stem Player's own outer border and the Time-Stretch wrapper's border die on mobile; the Tab Shell stage panel stays the single frame. The Tempo/Speed and Pitch Transposition **sub-boxes stay framed** at every breakpoint (they are the functional grouping), the **Click Track rail keeps its frame** (lane identity), and the **Stem Strips are untouched** at any breakpoint. One breakpoint — the `md` line the Tempo/Pitch grid already flips on — governs both the grid switch and the container drops; `md` and up paint exactly as ported.
- **Replace the Formant pill-slider with the square chip button** of the existing rail-button family (same treatment as the ♪/M/S squares): inline on the "Vocal Formant Preservation" label row, Mic icon (matching the Vocals **Stem** identity), pressed = on, unpressed = off, `role="switch"` + `aria-checked` semantics kept. A real rectangle in the row can never overhang a border.
- **Retire the Click Track mute concept end to end**: the "M" button dies, the `muted` axis drops from the Click Track lane state, from the engine surface, and from the **Session**'s persisted lane settings (old Sessions that wrote it are ignored on load — no back-compat, per the ADR-0011 Amendment precedent). The rail keeps the ♪ on/off switch and the volume fader; the **Export Bundle** rule is unchanged (it always gated the Click Track file on `enabled` + **Beat Grid**, never on mute).
- **Solo and Mute become per-Stem exclusive, last press wins**: pressing S on a muted Stem clears its mute; pressing M on a soloed Stem clears its solo. Enforced at the engine seam, not just the UI, so the all-silent solo+muted state is unrepresentable. A **Session** restoring a Stem with both flags set sanitizes at load in favor of **solo** (mute dropped silently).

Visual language is unchanged: same Grizzlython ramp, same tokens, same square-button family — every surviving part already exists in the shipped artifacts and components.

## User Stories

1. As a mobile user, I want the Mix Tab stage to sit in exactly one frame — the Tab Shell panel — so the Stem Player no longer paints a card inside a card.
2. As a mobile user, I want the Time-Stretch & Pitch wrapper's border gone, so the Tempo and Pitch groups sit directly on the stage instead of inside a third frame.
3. As a mobile user, I want the Tempo/Speed and Pitch Transposition groups to keep their own frames, so the functional grouping survives the flattening.
4. As a mobile user, I want the Click Track rail to keep its bordered lane look, so the lane still reads as its own affordance island.
5. As a mobile user, I want the Stem Strips' own frames and inner waveform frames untouched, so the lane identities keep their look while only wrapper levels flatten.
6. As a tablet/desktop user, I want the framed Mix stage exactly as ported, so the flattening is mobile-only.
7. As an engineer, I want the container drops and the Tempo/Pitch grid flip governed by one shared `md` breakpoint, so no 640–768 px zone ever shows a half-flattened layout.
8. As a mobile user, I want the Vocal Formant Preservation control fully inside the panel, so nothing overhangs a border under my thumb.
9. As any user, I want the Formant control to be the familiar square tap-button family (pressed = on, unpressed = off) instead of a sliding pill, so it matches every other control on the rail.
10. As any user, I want the Formant button to carry the Mic icon beside the "Vocal Formant Preservation" label and the "Vocals Stem" chip, so its target reads without hovering.
11. As a screen-reader user, I want the Formant control to stay a `role="switch"` with `aria-checked`, so the replacement keeps its announced on/off state.
12. As a mixer, I want the Click Track rail to expose exactly one on/off switch plus a volume fader, so there is no second button that also means "silence".
13. As a mixer, I want the ♪ switch to remain the control that materializes and releases the Click Track lane, so turning the lane off still stops its audio entirely.
14. As a mixer, I want the volume fader untouched (one and only one slider on the lane, no rate control of its own), so Time-Stretch still owns the Click Track's rate.
15. As a mixer who silenced the lane, I want the lane's volume fader to keep its value, so I can bring it back without re-dialing.
16. As a returning user, I want an old **Session** that persisted a Click Track mute flag to load simply without it, so retired state silently drops per the no-back-compat precedent.
17. As an exporter, I want the **Export Bundle** rule unchanged — exactly one Click Track file when the lane was `enabled` with a **Beat Grid** — so retiring mute changes nothing at export.
18. As a mixer, I want pressing Solo on a muted Stem to clear its mute and play that Stem alone, so Solo never lands me in an all-silent mix.
19. As a mixer, I want pressing Mute on a soloed Stem to clear its solo and silence that Stem, so M reads as "I do not want this one, drop the solo".
20. As a mixer, I want the last press to win on the M/S pair of a Stem, so the rail never needs me to un-press the other control first.
21. As a mixer, I want the illegal solo+muted state to be unrepresentable at the engine seam, so no code path — restore, init, or mid-playback edit — can ever smuggle it back in.
22. As a screen-reader user, I want the Stem's M and S buttons to keep their accessible names and `aria-pressed` states, so the exclusivity is felt without sight.
23. As a returning user, I want a **Session** that stored a Stem with solo AND muted to restore as solo with the mute flag dropped, so Session Recovery never replays the all-silent state.
24. As an engineer, I want the existing gain-matrix behavior otherwise identical (solo isolates unselected Stems; mute silences one), so only the illegal pair changes.
25. As a maintainer, I want the GLOSSARY **Click Track** definition amended to "its own on/off and volume controls", so the vocabulary stops promising a mute that no longer exists.
26. As a future reader, I want an amendment on the Click Track ADR recording why the lane has no mute (off + volume answer silence; export never consulted it), so nobody reintroduces the button.
27. As a future reader, I want an ADR recording the per-Stem solo/mute exclusivity and the load sanitizer rule, so a maintainer wondering "why does M clear S?" finds the answer.
28. As a maintainer, I want the mobile flattening itself to carry no ADR, since it is cheap to reverse and no one will be puzzled by it.
29. As an engineer, I want the retired affordances (Click Track mute button, the Formant pill-slider markup) banned from shipped code by the retired-affordances gate, so the check cycle refuses a reintroduction.
30. As an engineer, I want every pinned `data-testid` around the touched rails to still resolve (`check:testids` gate) after the button deaths and the chip-button birth.
31. As a mobile user, I want the Master Waveform spine, the Transport, the Stem lanes' mixer math, Time-Stretch/Pitch-Shift, and Session persistence otherwise untouched, so this is an affordance and container increment only.
32. As an engineer, I want the whole increment asserted through existing test seams, so no new seam is cut for a UI + state tidy-up.

## Implementation Decisions

- **Container flattening**: the Stem Player's root region and the Time-Stretch & Pitch wrapper region carry border-bearing class tokens that go bare below `md` (`hidden md:block` border pattern — hairline survives `md` and up only). The Tab Shell stage panel, the Click Track rail region, the Tempo/Pitch sub-boxes, and the Stem Strips keep their shipped classes verbatim. No padding, spacing, or token changes — only the border-bearing tokens at the two wrapper levels drop on mobile. The DOM seam cannot see media queries, so this is asserted through class tokens per the grz-18 precedent already in the repo.
- **Formant affordance re-home**: the pill-slider element (track + translating knob spans) dies; a square switch button from the existing rail-button family replaces it inline on the label row, keeping `role="switch"`, `aria-checked`, and the pressed/unpressed token pair the rail buttons already use (primary-filled pressed, secondary unpressed). The Mic icon reuses the Stem Strip's existing Mic glyph — zero new visual language, so the OpenDesign mandate stays in its removals-and-re-home exception (precedent: ADR-0008/ADR-0009).
- **Click Track lane state**: the lane state interface drops the `muted` field; the engine's mute-toggle surface for the lane dies; the rail DOM loses the second button; the volume icon's mute-face condition reties from `muted` to `volume === 0` so the visual feedback survives without the concept. Session persistence: the lane-settings payload stops writing the flag and its load gate ignores it (parallel to the ADR-0011 Amendment's phase/meter deletion — no back-compat, gate-validated load). The Click Track lane state stays otherwise parallel to the Stem mixer state minus the now-dead axis.
- **Export parity**: the Export Bundle's Click Track gating (`enabled` + non-empty Beat Grid) and the synthesized channel (uniform tap, volume not baked) stay exactly as shipped; the lane-settings prop type narrows to the reduced state. Existing bundle/encoder tests stay green untouched — that is the parity proof.
- **Solo/Mute exclusivity at the engine seam**: the Stem mute toggle clears `solo` when it presses; the Stem solo toggle clears `muted` when it presses — last press wins. The gain matrix code does not change: with the illegal pair unreachable, its existing branch for solo+muted simply never fires (kept for defensive shape or removed, engine's call — behavior identical).
- **Session load sanitizer**: at the Session load gate, restored Stem mixer settings with both flags set resolve to solo (mute flag cleared). The write side needs no change (the engine can no longer produce the illegal pair).
- **Retired-affordances gate**: the shipped-code ban list gains the Click Track mute affordance and the pill-slider markup markers, mirroring how the ADR-0011 Amendment's accent/downbeat symbols are gated; tests and comments stay exempt as that rule already does.
- **Record**: this spec plus five implementation tickets cut when porting begins — 01 mobile container flattening at `md`, 02 Formant chip-button re-home, 03 Click Track mute concept death (rail + engine + Session), 04 solo/mute exclusivity + load sanitizer, 05 verification and ADR record (ADR-0010 amendment + ADR-0012 + glossary amendment) — in the style of the `rail-hosted-chrome` increment.

## Testing Decisions

- Good tests observe external behavior only: rendered DOM, accessible names/roles/`aria` state, applied class tokens, and the engine's observable gain-matrix outcomes through the mock AudioContext factory seams. Never component internals, never private state.
- **All seams are existing — no new seam is cut**:
  - **Whole-app seam**: assert the flattening class tokens on the two wrapper regions and the absence of both retired affordances (mute button, pill markup) in the composed Mix stage.
  - **Stem Player component seam**: the Formant chip button's accessible name, switch role, and Mic glyph; the Click Track rail's exactly-one-button (♪ switch) + one-slider shape; exclusivity as button-press behavior at the rail level.
  - **Time-Stretch/stem-player DOM seam (existing Click Track rail tests)**: retarget the pinned rail assertions — the rail testid set loses nothing but the mute button's accessible-name pin retires; the tempo-only readout and single-slider assertions stay.
  - **Engine seam**: the toggle-pair reducer behavior (solo press clears mute; mute press clears solo; second press re-arms) asserted on state, plus gain-matrix outcomes through the mock AudioContext factory — the existing mixer-state describe blocks are the prior art.
  - **Session persistence seam**: the lane-settings round-trip test updates to the reduced state; a stored legacy payload carrying the retired flag loads without effect; the restored-mixer sanitizer (solo+muted → solo) asserts through the same gate the existing session-recovery tests already use.
- **Responsive truth at the DOM seam is class tokens** (grz-18 precedent): the DOM seam does not evaluate media queries, so mobile flattening asserts the `hidden md:block`-style token pair, not computed layout.
- **Parity guards**: existing bundleZip and ExportDialog Click Track tests stay green untouched; existing StemStrip seam tests stay green (the strips themselves change nothing).
- Prior art to imitate: the grz-18 rail class-token assertions, the existing Click Track rail DOM tests, the engine mixer-state describe blocks with the shared mock AudioContext factory, and the sessionStore gate-validation tests.

## Out of Scope

- Audio behavior: the Inference Engine, Model Profile selection, separation pipeline, Time-Stretch/Pitch-Shift/Formant Preservation math, mixer gain math beyond the exclusivity rule, Transport, Master Waveform spine, and every export encoder — the Click Track export rule and its bytes stay byte-identical.
- Tab Shell chrome (Tab Rail, Brand Unit, sticky mobile block), the Separate/System/Export Tabs, and the gated-Tab mechanics.
- Stem Strip internals: waveform rendering, badge chips, M/S button geometry, and their volume fader — only the _state_ behind M/S changes, never the buttons' own look or layout.
- Desktop/tablet painting at `md` and up; palette, typography, and token changes; no OpenDesign run in this increment (re-home/removals exception).
- Session Recovery flow, Discard/purge wiring, and the IndexedDB persistence mechanism (only the two load gates touch payload shape).
- Hand Calibration tap strip, Tempo Detector candidate picker, and Beat Grid machinery.

  _Amendment note (2026-11-03): the Amendment below brings the Hand Calibration tap strip and the Tempo Detector candidate picker into scope; the Beat Grid machinery stays out of scope there too. Likewise the Amendment revises the **Master Waveform**'s and **Transport** readout surfaces and re-homes whole rails — claims 1 and 31 above held exactly as written for that increment, and are not rewritten retroactively._

## Further Notes

- Decisions were reached in a grilling session (four issues → twelve settled questions, empty frontier); the tree's answers are encoded above.
- Breakpoint authority is the `md` line the Tempo/Pitch grid already flips on — the repo's rule against a second "desktop" breakpoint (ADR-0009 lesson: a drifting pair reintroduces the drift it removed).
- The GLOSSARY amendment is exactly one definition: **Click Track** loses the word "mute" from its controls clause. The Formant concept entry (**Formant Preservation**) is untouched — the affordance changed, the domain concept did not.
- Two ADR artifacts accompany the port: an amendment span on the Click Track ADR (lane mute retired, no back-compat) and one new ADR for the per-Stem solo/mute exclusivity (last press wins + solo-wins load rule).
- `check:testids` gates the retargeted pins; `check:retired-affordances` gains the two new retired affordances; the full pre-commit cycle re-runs green.
- Watch the sibling trap: the Stem Strip's M button and the Click Track's retired M button are different rails — the Stem mute stays alive; only the Click Track lane loses mute.

---

# Amendment: Mix Tab cohesion and the single Playhead readout

Status: resolved-in-full (tickets `06`–`10` all resolved on branch `mix-tab-cohesion`; the increment's green is promised at ticket `10`).

Recorded on the tracker 2026-11-03, as an amendment of the above spec rather than a new feature: the increment re-homes rails this spec already touched and retires a readout surface it never visited. It partially supersedes `docs/adr/0008-four-tab-shell-and-single-toggle-transport.md` (the Mix Tab's rail order and its two competing readouts); a new **ADR-0013 "Mix Tab cohesion and the single Playhead readout"** is authored at porting start. The **OpenDesign** mandate runs in its documented dead-MCP fallback: the MCP answered nothing this session, so the reordered Mix stage's look is agent-authored and recorded as such on tickets `07`–`09`. Glossary terms used throughout: **Playhead**, **Rail**, **Stem Strip**, **Master Waveform**, **Transport**, **Stem Player**, **Click Track**, **Beat Grid**, **Hand Calibration**, **Tempo Detector**, **Session**, **Source Mix**, **Time-Stretch**, **Pitch-Shift**, **Formant Preservation**, **Tab Shell**, **Tab**.

## Problem Statement

The shipped Mix **Tab** fights itself in three ways, visible in one screenshot of the stage:

1. **The spine lies about the Playhead.** While the **Stems** play, the **Master Waveform**'s lime playhead and its played-portion highlight stay parked where the last mixer event happened — the stage showed `0:25` on the spine against `00:28` in the **Transport**. The reason is structural: the spine is fed an app-level position that only mixer, volume and seek events write, while the live position the **Stem Player** knows arrives through a different channel entirely. So five **Playhead** renderings exist (the spine's, one per **Stem Strip**), and only four of them agree.
2. **One Playhead, two visible clocks.** The spine's header carries a `mm:ss / mm:ss` readout and the **Transport** row carries another — a redundancy the drift then made worse, because the two readouts disagree.
3. **The rails are ordered against the narrative.** Top-down today: spine → a full-height empty **Hand Calibration** slab that eats a third of the fold → **Stem Player** title and **Transport** → the **Click Track** **Rail** floating above the **Time-Stretch** panel → and the four **Stem Strips**, the thing you actually mix, last, below the fold. The **Beat Grid** decisions (the **Tempo Detector** candidate picker, the tap strip) are scattered, and the candidate picker's four chips sit inside a **Rail** that owns nothing but an on/off and a volume.

## Solution

One **Playhead**, one clock, one readout, and rails ordered the way the work is done:

- **The engine's position becomes the truth.** A dedicated position channel out of the **Stem Player** into the app feeds the **Master Waveform**'s playhead, so the spine, the four **Stem Strips** and the **Transport** readout are always the same value. The channel is domain-separate from the mixer-and-**Session** bridge, which keeps its own meaning and is never fired per frame.
- **The Transport owns the only visible readout.** The spine's header keeps its label and its "Overview" chip; its `mm:ss / mm:ss` group dies. The canvas tick graduations survive — they are the time axis, not a position.
- **The timeline neighbourhood gathers every surface that carries a time axis**, in reading order: **Master Waveform** → **Hand Calibration** tap lane → **Tempo Detector** candidate picker → **Transport** row. The candidate picker stops living inside the **Click Track** **Rail**: it becomes its own **Rail** (its own identity and controls), rendered as the first rail of the **Stem Player** section, which is why it can never land inside the lane root the rail-shape pins guard.
- **The mixer block becomes five lanes**: the four **Stem Strips**, then the **Click Track** **Rail** last of the lanes, holding only its on/off, its volume, and its one readout of the **Beat Grid** it is locked to.
- **Rate and key come last**: the **Time-Stretch** & **Pitch-Shift** section is the final rail of the Mix stage — mix the sound, then bend it.
- **The tap lane collapses** from a bordered card to a thin lane on the spine's width and time axis, one mono micro-line of copy, Confirm/Reset kept; the **Hand Calibration** decision and the surface that asks for it stay one sentence apart in the glossary, not two features.

Visual language is unchanged: same tokens, same square-button family, same mono readout face; only one readout group is deleted outright. The **Inference Engine**, the **Stem Player** engine surface, the **Beat Grid** machinery, the mixer gain math, the **Export Bundle**, and every encoder stay untouched.

## User Stories

1. As a mixer, I want the **Master Waveform**'s playhead and its lime played-portion to move while the **Stems** play, so I can see how far the mix has gotten without touching anything.
2. As a mixer, I want the spine, the four **Stem Strips**, and the **Transport** to show one and the same **Playhead** at every instant, so no surface on the Mix stage ever lies about where playback is.
3. As a mixer who scrubbed the spine and then pressed play, I want the position I scrubbed to be the position that plays, so the timeline surface and the transport are one mechanism.
4. As a mixer, I want exactly one visible `mm:ss` readout in the Mix Tab — the **Transport**'s — so I stop reading two clocks for one position.
5. As a mixer, I want the **Master Waveform**'s header to keep its label and its "Overview" chip while its own clock dies, so I can still tell that surface apart without a second readout under my eye.
6. As a mixer, I want the canvas tick graduations (`0:00 0:30 … 3:30`) to survive on the spine, so the time axis I scrub against stays legible.
7. As a keyboard user, I want the spine's `aria-valuenow` and `aria-valuetext` to carry the exact **Playhead** even when its repaint is throttled, so the assistive readout is never a stale approximation.
8. As a mixer at 0.5× or 2.0×, I want the readout to keep counting canonical **Source Mix** seconds, so the clock never changes meaning when **Time-Stretch** changes.
9. As a returning user, I want the live **Playhead** bridge to leave **Session** persistence at its current cadence, so a resumed **Session** still lands at a position the mixer events already saved.
10. As an engineer, I want the spine's canvas repaint capped near 15 draws per second, so a rAF-fed position channel never repaints ~800 waveform bins per frame.
11. As a mixer, I want the **Hand Calibration** tap lane welded directly under the **Master Waveform**, same width and same time axis, so tapping the groove I heard is a gesture against the axis I can already see.
12. As a mixer, I want the tap lane reduced to one mono micro-line of instruction plus its Confirm and Reset buttons, so the escape hatch stops eating a third of the fold while it is idle.
13. As a mixer, I want the tap lane's four testid pins (strip, readout, confirm, reset) to keep resolving after the collapse, so the rail-tidy-up gate stays honest.
14. As a mixer, I want the **Tempo Detector** candidate picker and its confidence line lifted out of the **Click Track Rail** and set between the tap lane and the **Transport** row, so the reading of the **Beat Grid** sits with the tools that change it.
15. As a mixer, I want the **Click Track Rail** to keep only its on/off, its volume, and the one readout of the **Beat Grid** it is locked to, so a lane means a lane everywhere: identity plus its own controls.
16. As a mixer, I want the **Click Track** lane to sit with the four **Stem Strips** — five lanes together, lane last — so everything with a volume slider is one block.
17. As a mixer, I want the four **Stem Strips** above the fold and above the rate knobs, so the thing I mix is the first thing I reach for.
18. As a mixer, I want the **Time-Stretch** & **Pitch-Shift** section to be the last rail of the Mix stage, so the sequence reads: hear it, mix it, then bend its rate and key.
19. As a mixer, I want the "Multi-Track Stem Player" title, its Layers mark and its tagline to survive at the head of the **Transport** row, so the reorder moves whole rails around the heading rather than demoting what the app seam pins.
20. As a mixer, I want the **Vocal Formant Preservation** switch and its **Pitch-Shift** group to stay intact inside the **Time-Stretch** section, so reordering does not disturb the chip button that increment `02` re-homed.
21. As a mobile user, I want one rail order at every breakpoint, so no Mix-Tab-specific mobile block reintroduces a second composition.
22. As a mobile user, I want the **Master Volume** fader to keep its `lg`-only hiding and the **Transport** row to keep stacking below `md`, so the flattening increment's responsive truths survive.
23. As a mixer, I want the spine to remain the only scrub surface and the **Stem Strips** to keep showing their share of the **Playhead** without growing their own scrubber, so one timeline gesture drives one position.
24. As a screen-reader user, I want the relocated candidate chips to keep their "Re-lock Beat Grid to … BPM" / "Beat Grid locked to … BPM" names, their `aria-pressed` lock state, and their confidence line, so the picker is usable without sight after it moves.
25. As a screen-reader user, I want the picker to become a **Rail** with its own group role and accessible name, so a lifted-out island is announced as a control group, not loose chips on the stage.
26. As a mixer mid-re-lock, I want the **Beat Grid** swap, the re-lock pass, and the "calibrated by hand" honesty of the lane readout untouched by this reorder, so the **Beat Grid** machinery stays exactly where it works.
27. As a mixer, I want the **Export Bundle** rule and the Export Tab's view of the mixer state untouched, so reordering the Mix stage changes nothing about what leaves the app.
28. As a maintainer, want the rail order, the readout death, and the picker's relocation to stay inside the components that already own them — no new component, no rail changing owner — so the port is a placement increment, not a re-architecture.
29. As a maintainer, I want the **GLOSSARY** to name **Playhead** (one value, one clock), **Rail** (a control group inside a Tab, distinct from the chrome's **Tab Rail**), and **Stem Strip** (the per-**Stem** row), so "five lanes together" and "one **Playhead**" are speakable without gesture words.
30. As a future reader, I want **Hand Calibration** and the surface named "Calibrate the Click" recorded as one sentence apart — the decision and the tool that asks for it — so nobody builds a second hand-calibration feature.
31. As a future reader, I want **ADR-0013** to record why exactly one `mm:ss` survives, why the picker is not in the lane, and why the **Transport** holds the clock instead of the spine, so a maintainer wondering "why did they do it this way?" finds the trade-offs.
32. As an engineer, I want a test that plays with no mixer event at all and asserts the spine's `aria-valuenow` walks off its start value, so the drift in the screenshot can never regress silently.
33. As an engineer, I want the existing Mix-Tab scrub pins (keyboard step, pointer scrub, spine absent from the other three Tabs) to stay green untouched, so the shared-engine contract survives the reorder.
34. As an engineer, I want the retired spine readout and its header marker banned in shipped code, so the check cycle refuses a reintroduced second clock.
35. As an engineer, I want the whole increment asserted at existing seams only — no new seam cut — so the tidy-up stays testable where it already is testable.

## Implementation Decisions

- **Modules modified**: the app's Mix Tab composition (order of the **Master Waveform** spine and the **Hand Calibration** lane, plus the wiring of the new position channel), the **Stem Player** component (its section's rail order and the new outbound position channel), the **Master Waveform** component (readout group dies; canvas repaint ceiling added), and the **Hand Calibration** lane component (collapse of its card look). The **Stem Player** engine, the **Beat Grid** machinery, the **Stem Strip** component, the **Session** store, and the export path are untouched.
- **New interface, one seam deep**: the **Stem Player** component gains one outbound channel in the shape `onPlayheadChange(timeSec: number)` — fed by the engine's existing position subscription. The existing mixer-and-**Session** bridge (stems, **Master Volume**, position at mixer events) keeps its contract and is **not** used to carry per-frame position; the **Session**'s save cadence is unchanged, so a resumed **Session** may land at the last mixer position rather than mid-flight playback.
- **Playhead clock is canonical Source Mix seconds**, invariant under **Time-Stretch** and **Pitch-Shift**: the readout denominator never shortens when tempo changes, which is the claim the existing canonical-duration anchor already pins.
- **Repaint ceiling inside the spine**: the canvas redraw is time-gated near 15 draws/s while the position value itself keeps flowing every frame, so `aria-valuenow`/`aria-valuetext` stay exact and only the paint is throttled. The ceiling is an implementation constant, asserted only through value exactness — never through frame counts.
- **Order, top-down in the Mix stage**: spine → **Hand Calibration** lane → candidate-picker **Rail** → **Transport** row (title + Play/Pause + Master Volume) → four **Stem Strips** → **Click Track Rail** → **Time-Stretch & Pitch-Shift**. The picker renders as the **Stem Player** section's first rail, which is what keeps its four `role="button"` chips out of the lane root — the rail-shape pins assert zero buttons inside the lane.
- **Rail ownership stays put**: the picker, the lane, and the **Time-Stretch** section stay children of the **Stem Player** component; only the spine and the tap lane are composed at the app level, and only their order changes there. No rail changes owner, no new component, no new breakpoint fork.
- **The candidate picker becomes its own Rail**: `role="group"` with its own accessible name, keeping the pinned testids for the picker, the confidence line, and the readout, and keeping the honest ranking copy ("readings ranked · pick the feel you hear", "calibrated by hand") verbatim.
- **The tap lane keeps its DOM identity**: the strip, readout, confirm and reset testids all survive the collapse; only the card look (its height default, its outer padding and border rhythm) reduces so it reads as a lane on the spine's width and axis.
- **Record before coding**: **GLOSSARY** entries for **Playhead**, **Rail**, and **Stem Strip** plus the **Hand Calibration** tool/decision pairing are written ahead of the port (they are vocabulary, not code), and **ADR-0013** is authored at porting start recording the readout trade-off, the picker relocation, and the clock's home.
- **No OpenDesign run**: the MCP answered nothing this session (the dead-MCP fallback in the repo's agent docs), so the reordered stage's look is agent-authored and each affected ticket says so.

## Testing Decisions

- A good test here observes external behavior only: rendered DOM, accessible names/roles/`aria` state, applied class tokens, and the **Playhead** value through the spine slider's `aria-valuenow` — never component internals, never the engine's private position.
- **Seams — all existing, none new** (highest first):
  - **Whole-app Mix-Tab seam** (the existing app-level **Mix Tab** region tests, already driving the full load-and-separate flow): the new live-**Playhead** regression — press play, assert the spine's `aria-valuenow` walks off its start with no mixer event fired; the one-clock absence pin for the spine's deleted `mm:ss` group; the Mix stage's rail order read off the region's children; the picker's chips asserted **outside** the **Click Track Rail** root; the spine still absent from the Separate, Export and System Tabs.
  - **Stem Player component seam** (the existing Mix-player DOM tests): the lane's zero-button shape and its one switch + one slider, the four **Stem Strips** as four `role="group"` named `/stem$/`, the heading surviving, and the picker island rendered before the **Transport** row.
  - **Master Waveform component seam** (the existing component-level tests): the readout group's absence at the component, the tick graduations surviving, and `aria-valuenow`/`aria-valuetext` exactness against a moving **Playhead**.
  - **Time-Stretch/stage DOM seam** (the existing **Click Track Rail** fixture tests): the picker and confidence-line pins retarget by location only — they are global `getByTestId` accesses, so relocation is green by construction; the rail's own class-token and shape pins stay.
  - **Engine seam** (the existing **Stem Player** engine tests): parity guard only — the position subscription is already public, so no new engine surface is added and those fixtures stay green untouched.
- **Prior art to imitate**: the existing "hosts the **Master Waveform** spine on the Mix Tab and mirrors the shared playhead" test (keyboard and pointer scrub through the shared engine, spine absent from the other Tabs) is the nearest seam for the new mirror pin; the rail class-token assertions are the precedent for breakpoint truth at the DOM seam; the honest-ranking readout tests are the precedent for the relocated picker's copy.
- **Test-name retarget, not test change**: the canonical-duration anchor test is named "anchors **Master Waveform** duration display to canonical duration…" but its literal (`00:05`, zero-padded minutes) is the **Transport** denominator's face, not the spine's (`0:05`). The pin stays green untouched; the name gets retargeted to say **Transport**, since after this increment the spine has no visible duration at all.
- **Gate deltas**: `check:testids` gains nothing and loses nothing — the deleted readout carries no testid, and the tap lane's four testids survive, so its presence pins still resolve and its absence half is the pin that proves the readout stayed gone. `check:retired-affordances` gains the spine header's readout marker so a second clock cannot come back in shipped code. `check:glossary` must be green against the three new terms. `check:doc-anchors` owes nothing: no `NAME = number` record moves. The ADR-0011 replays are not owed — no derived number in the **Beat Grid** repair or in the ADRs moves.
- **Suite shape expectation**: one net new test (the live mirror), plus retargets of the readout-absence and rail/picker location assertions; the pre-commit cycle (lint-staged, glossary, doc-anchors, test-fixtures, testids, retired-affordances, typecheck, suite) re-runs green.

## Out of Scope

- Audio behavior: the **Inference Engine**, **Model Profile** selection, the separation pipeline, the **Beat Grid** machinery and re-lock pass, **Time-Stretch**/**Pitch-Shift**/**Formant Preservation** math, the mixer gain matrix, and every export encoder and **Export Bundle** member.
- The **Stem Player** engine's own position machinery: the subscription exists and is already public; the increment consumes it, never edits it.
- **Session** Recovery flow, the IndexedDB persistence mechanism, and the auto-save cadence (the resumed **Playhead** lands at the last mixer position by design).
- **Tab Shell** chrome (the **Tab Rail**, the **Brand Unit**, the merged sticky block), gating of the Mix/Export Tabs, and the Separate/System/Export Tab bodies.
- **Stem Strip** internals: their per-lane waveform, badge chips, M/S buttons and volume faders — they receive the same **Playhead** value and change nothing of their own.
- Palette, typography, token changes, and any new visual language: the reorder is a placement and removals increment, so the OpenDesign exception applies and only the dead MCP fallback's look (already recorded on the tap-strip and rail tickets) is reused.
- The mobile-specific Mix block: forbidden outright — one order at every breakpoint.

## Further Notes

- Settled in a grilling session whose tree was walked to an empty frontier (rounds 1–4, every question accepted): the answers above encode it. **Playhead**, **Rail** and **Stem Strip** were written to the **GLOSSARY** the moment they crystallised, ahead of the port.
- Correction recorded for the record: this spec never prescribed a rail order or a readout deletion — the order cited during grilling as "the stale spec's" was read off the shipped DOM, not off this file. The three claims above that are worth re-reading against today's code are the Out-of-Scope line about the tap strip and candidate picker, and story 31's claim that the spine and **Transport** were untouched.
- The one-screenshot symptom is two bugs at once: the drift is the stale position channel, and the redundancy is two clocks. Fixing the channel without deleting a readout leaves the redundancy; deleting a readout without the channel leaves a spine that still lies. Both belong in the same increment, and story 32's test is what keeps the first one from regressing.
- Watch the sibling traps: (a) the spine header's `Overview` chip survives while its `mm:ss` group dies — one surface, half retired; (b) the tap lane's four testids all survive the collapse while its card look does not; (c) the picker's four `role="button"` chips moving **out** of the lane root is exactly what makes the lane's zero-button pin meaningful, so the relocation and the lane's shape pin are one change, not two; (d) the canonical-duration anchor test's name names the **Master Waveform** while its literal is the **Transport** face.
- The look is agent-authored by the documented dead-MCP fallback (the MCP answered nothing, so no doomed design call is paid per ticket) — recorded on tickets `07`–`09` per `AGENTS.md`, the same route the tap strip and the rail chrome already took.
