# Spec: Mix Rail Tidy-Up — Mobile Container Flattening, Formant Chip Button, Click Track Mute Death, Solo/Mute Exclusivity

Status: ready-for-agent

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

## Further Notes

- Decisions were reached in a grilling session (four issues → twelve settled questions, empty frontier); the tree's answers are encoded above.
- Breakpoint authority is the `md` line the Tempo/Pitch grid already flips on — the repo's rule against a second "desktop" breakpoint (ADR-0009 lesson: a drifting pair reintroduces the drift it removed).
- The GLOSSARY amendment is exactly one definition: **Click Track** loses the word "mute" from its controls clause. The Formant concept entry (**Formant Preservation**) is untouched — the affordance changed, the domain concept did not.
- Two ADR artifacts accompany the port: an amendment span on the Click Track ADR (lane mute retired, no back-compat) and one new ADR for the per-Stem solo/mute exclusivity (last press wins + solo-wins load rule).
- `check:testids` gates the retargeted pins; `check:retired-affordances` gains the two new retired affordances; the full pre-commit cycle re-runs green.
- Watch the sibling trap: the Stem Strip's M button and the Click Track's retired M button are different rails — the Stem mute stays alive; only the Click Track lane loses mute.
