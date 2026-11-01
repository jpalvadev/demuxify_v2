# Spec: Four-Tab Shell, Toggle Transport, Inline Export

Status: ready-for-agent

Recorded on the tracker 2026-11-01. See `docs/adr/0008-four-tab-shell-and-single-toggle-transport.md` (partially supersedes ADR-0007). Glossary terms used throughout: Tab Shell, Tab, Transport, Stem Player, Master Waveform, Source Mix, Stems, Session, Export Bundle, Custom Mixdown, Time-Stretch, Pitch-Shift, Formant Preservation.

## Problem Statement

The app's Tab Shell forces users through a redundant surface: the Listen Tab duplicates the Mix Tab's playback, playback itself needs two buttons plus a Seek button nobody uses, exporting requires hunting for an "Export Stems" action button on the Mix Tab before the Export Tab becomes useful, and a destructive trash button sits in the middle of the playback surface inviting accidents. Users find these controls "wonky" and want them gone or merged.

## Solution

Revise the Tab Shell to exactly four Tabs — **Separate**, **Mix**, **Export**, **System** — with playback living solely in the Mix Tab. The Transport collapses to a single **Play/Pause toggle** whose icon shows the action coming next (no Seek-to-start button; scrubbing the Master Waveform spine stays the timeline surface). The **Export panel** renders inline in the Export Tab whenever Stems exist, fed live through the Transport bridge — no action button, no modal. The Mix Tab's trash button dies, and the Separate Tab's Session Recovery **Discard becomes a full purge** that deletes everything.

## User Stories

1. As a listener, I want the Tab Shell to show exactly four Tabs (Separate, Mix, Export, System), so that I never click through a redundant playback surface.
2. As a first-time visitor, I want the Mix and Export Tabs grayscaled with a reason line until Stems exist, so that I know what will unlock after Separation.
3. As a user who just completed Separation, I want the app to land me on the Mix Tab, so that playback of the new Stems is immediate without hunting for a Tab.
4. As a returning user resuming a saved Session, I want the app to land me on the Mix Tab too, so that my playhead and mixer levels are right in front of me.
5. As a mixer, I want ONE Transport button that toggles between playing and pausing, so that a single control expresses a binary state instead of two buttons.
6. As a mixer, I want the toggle's icon to show the action coming next — ▶ while paused, ⏸ while playing — so that pressing it always does the thing the icon promises.
7. As a keyboard user, I want Space to toggle that same button, so that I never need the mouse for playback.
8. As a screen-reader user, I want the toggle to carry one accessible name and a proper pressed state, so that assistive tech announces "pause button, not pressed" correctly.
9. As a listener, I want no dedicated Seek-to-start button anywhere, so that the Transport row stays minimal.
10. As a listener, I want dragging the playhead on the Master Waveform spine in the Mix Tab to reposition playback, so that timeline navigation is one mechanism instead of a button plus a scrub.
11. As a listener, I want the mono time readout and the Master Volume control to stay in the Mix Tab's Transport row, so that pausing still tells me where I am.
12. As someone who wants to export, I want the Export panel already visible in the Export Tab whenever Stems exist — no "Export Stems" action to click first, no modal to open.
13. As someone exporting, I want the Export panel to always reflect my latest mixer states, Master Volume, Time-Stretch tempo, Pitch-Shift, and Formant Preservation, so that my Export Bundle and Custom Mixdown match exactly what I have been hearing.
14. As someone exporting, I want tweaks I make while the Export panel is on screen to appear in it live, so that I can dial volumes and then export without re-opening anything.
15. As a mixer, I want NO Export Stems button on the Mix Tab, so that the Export Tab is the single export surface.
16. As an exporter, I want the Cancel control inside the Export panel to stay, so that I can abort an Export Bundle mid-export.
17. As a listener, I want no trash / Reset Session button on the Mix Tab, so that nothing destructive sits in the middle of the playback controls.
18. As a returning user, I want the Discard button in Session Recovery (on the Separate Tab) to delete EVERYTHING: the saved Session and the in-memory Source Mix, Stems, mixer levels, and playhead, so that one confirmed gesture gives me a clean app.
19. As a returning user, I want Discard to keep its trash icon, so that the destructive meaning is visible where it matters.
20. As a maintainer debugging the app, I want the System Tab's Clear Logs button and its trash icon untouched, so that diagnostics remain clearable.
21. As a user mid-session, I want switching songs via the Separate Tab's Replace/Change Source Mix action to remain the way to swap Source Mixes, so that removing the Mix Tab purge doesn't lock me into one song.
22. As a user, I accept that a true start-fresh mid-session means reloading and Discarding, so that no always-on wipe button exists to fat-finger.
23. As an app user, I want selecting a gated Tab to fall back to Separate exactly as today, so that gating behavior doesn't regress.
24. As an engineer, I want the Inference Engine, Stem Player engine logic, mixer math, and export encoders untouched, so that this is purely a UI-surface revision.

## Implementation Decisions

- **Tab Shell surface layer** (app component): the Tab list goes from five entries to four (Separate, Mix, Export, System); the `gatedUntilStems` flags on Mix and Export stay as-is. The entire Listen Tab panel — its hosted Transport row and its copy of the spine — is deleted from the surface; no new seam is introduced.
- **Auto-selection targets**: the two places that selected the Listen Tab (after separation completes, after Session resume) select Mix instead.
- **Stem Player component**: the Transport row renders one toggle button — icon bound to playing state (▶ while paused, ⏸ while playing), single accessible name, `aria-pressed` semantics — replacing the Play and Pause buttons. The Seek-to-start button and the Purge Session button are removed from the row. The Export Stems action button is removed entirely from the Stem Player.
- **Stem Player bridge interface stays put**: the app↔player bridge keeps its `play` / `pause` / `seek` callbacks; the toggle calls play or pause depending on state, and the spine scrubbing keeps using the existing `seek` callback. No bridge signature changes; engine-facing code is untouched.
- **Export panel**: mounted inline and always present in the Export Tab whenever Stems exist; the open/close state that the old Export Stems action drove is deleted from the surface layer. Live state continues to flow through the Transport bridge, which already re-emits mixer states, Master Volume, and Time-Stretch (tempo, pitch, formant preservation) on every mixer/volume/tempo/pitch change — all existing emission call sites must be preserved so the panel never goes stale. The Cancel control inside the panel stays; the standalone-fallback branch of the panel (used only outside the app) is left alone.
- **Discard becomes full purge**: the Session Recovery Discard handler is rewired to the old purge semantics — cancel auto-saver, drop cached Session, clear saved Session from storage, and clear the in-memory Source Mix, Stems, and mixer — reusing the existing purge routine rather than duplicating it. The Session Recovery component itself keeps its Discard/Resume buttons and trash icon; only its wiring at the app level changes.
- **System Tab Clear Logs**: untouched.
- **No OpenDesign run** for this increment (deliberate exception, recorded in ADR-0008): the change is removals plus one icon-state button; it is ported directly into the React surface components with the existing Bold visual identity and shadcn token conventions.
- Glossary entries **Transport** (single toggle, no seek button) and **Tab** (four surfaces) were already updated; ADR-0008 was recorded partially superseding ADR-0007.

## Testing Decisions

- Good tests observe external behavior only: rendered DOM via the testing-library (regions, buttons, icons, `aria-pressed`), keyboard-driven Space toggle via `fireEvent.keyDown`, gating classes visible on the Tab strip — never internal component state or engine internals.
- Primary seam (highest, existing): the whole-app seam — render `App` with the standard mocks (audio decode, WebGPU capability detection) and `fake-indexeddb`, as the existing app-level test describe block already does. Cover there: exactly four Tab regions and no Listen region; separation/resume land on Mix; toggle button presence, icon swap on state, `aria-pressed`, Space toggling; absence of Seek/Purge/Export-Stems buttons in Mix; Export panel present inline whenever Stems exist and its live mirror of mixer/Master Volume/Time-Stretch state; Discard wiping both the fake-IndexedDB saved Session and the in-memory app state (subsequent render shows clean Separate Tab).
- Secondary seam (existing, keep): the Stem Player component seam with its mock AudioContext — update its existing tests that targeted the deleted Seek/Purge/Export-Stems buttons and the Play/Pause pair; assert the toggle button's accessible name, pressed state, and that play/pause engine calls still happen through it.
- Prior art to imitate: the existing app-level tests using `waitFor` / `fireEvent` / `within(region)` on Tab regions (including the "mirrors live Stem Player mixer state into the Export Tab panel" test, which survives with its trigger changed), and the Session-recovery tests asserting IndexedDB resume behavior — the purge test is its mirror image.
- No new seams; the count stays at the existing two.

## Out of Scope

- Inference Engine, model profiles, Model Cache, separation pipeline, mixer math, Time-Stretch/pitch engine, and export encoders (WAV/MP3/ZIP) — logic untouched.
- IndexedDB Session schema and auto-saver mechanics beyond rewiring Discard's handler.
- System Tab diagnostics, Fallback Advisory, Model Cache status; Clear Logs stays as-is.
- Session Recovery Resume flow beyond changing its post-resume Tab target.
- Visual language: Bold identity, acid-lime accent, quartet hues, woff2 typography — no new design pass, no OpenDesign run (ADR-0008).
- Mobile rail layout mechanics (carry the four Tabs through the existing strip).

## Further Notes

- Decisions were reached via a grilling session; the resulting design tree is fully recorded in ADR-0008 and the updated GLOSSARY.md.
- "Icon shows the action coming next" is the agreed semantic — worth encoding once in the toggle implementation, not duplicated across components.
- The Transport bridge's existing live-state emissions (12 change paths in the Stem Player) are the mechanism the "latest tempo/pitch" requirement rides on — preserving them is the whole job for that story.
- Repo rule tension: AGENTS.md mandates OpenDesign for visual redesigns; this increment is the deliberate exception, justified in ADR-0008. If a future change introduces new visual language, the OpenDesign rule resumes normally.
