# Four-Tab Shell, Toggle Transport, and Inline Export

Revise the Tab Shell from [ADR-0007](./0007-tab-shell-ui.md): the **Listen** Tab is removed and the Shell has exactly four Tabs — **Separate**, **Mix**, **Export**, **System** (Mix and Export still grayscaled until Stems exist). Playback lives solely in the Mix Tab: the Transport is a single **Play/Pause toggle** whose icon shows the action coming next (Space toggles it too), with no dedicated Seek-to-start button; scrubbing the Master Waveform spine remains the timeline surface. The Export panel is **inline in the Export Tab**, always available when Stems exist and fed live through the Transport bridge (mixer states, Master Volume, Time-Stretch/Pitch/Formant Preservation), replacing the Export Stems action button in the Mix Tab. The Mix Tab's Purge/Reset Session trash button dies: the Separate Tab's Session Recovery **Discard becomes a full purge**, clearing the saved Session _and_ the in-memory Source Mix, Stems, and mixer; mid-session starts are covered by Replace/Change Source Mix.

## Considered Options

- Keep Listen Tab as a dedicated playback surface (rejected: redundant with the Mix Tab's Stem Player, one more Tab to click through).
- Keep dedicated Play and Pause buttons (rejected: two buttons for one binary state; the toggle matches standard player ergonomics and the repo's own glossary _Avoid_ list was inverted deliberately).
- Keep a Purge affordance in Mix or System (rejected: Discard-as-full-purge on Separate plus reload covers wiping; an always-on destructive button in Mix invites accidents).
- Design this increment in OpenDesign (rejected: no new visual language, just removals and one icon-state button, plus the Grizzly header band re-homed into the System Tab with its two marks from the grizzlython-skin artifacts — no new visual language either, so it is ported directly into the React components with the same exception; see the grz-11/13/15/18 addendum in `.scratch/grizzlython-skin/03-grz-header-band.md`).

## Supersede

Partially supersedes [ADR-0007](./0007-tab-shell-ui.md): the Tab Shell frame, grayscaled gating, shared spine, Bold visual identity, and port-through-React process stay; "exactly five Tabs" (Listen), the Transport bridge hosted in Listen, and the click-to-open Export panel no longer apply.
