# 07: Master Waveform as a shared spine

**What to build:** One shared Master Waveform spine belongs to the Tab Shell rather than to a player card: it renders identically in Listen and Mix at the exact same playhead position, so scrubbing in one Tab resumes at the identical spot in the other, and it is hidden in Separate, Export, and System. Click/pointer scrubbing, keyboard seek, and per-Stem waveform strips keep their existing interactions; canvas playhead rendering stays crisp on the near-black canvas.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] Single waveform instance shared across Listen and Mix; playhead position is identical when switching Tabs in either direction.
- [x] Waveform absent from Separate, Export, System panels.
- [x] App-level tests assert the shared-position behavior across Tab switches; Master Waveform test seam still green.

## Answer

Commit `8243c3e` — `feat(tab-shell-ui): ticket 07 - shared Master Waveform spine in Listen and Mix at identical playhead` (full suite green: 37 files / 285 tests).

- The spine now belongs to the Tab Shell: `App.tsx` mounts `MasterWaveform` in the Listen Tab panel (full height, with the ticket-06 transport row under it) and a mini overview in the Mix Tab panel (`height={84}`) — both bound to the same app-level `currentTime` state and the same `handleSeek`. Neither Separate, Export, nor System panels render a waveform.
- `StemPlayer` gained `masterWaveformHosted?: boolean`; when the shell hosts the spine the player's own overview waveform is omitted, so the Mix Tab shows exactly one spine (the shell's mini) above the Stem Player card. Standalone renders (per-component seam) keep their internal waveform — `StemPlayer.test.tsx` and `MasterWaveform` component seams untouched and green.
- Scrub ↔ engine sync: the transport bridge (`TransportControls`, ticket 06) gained a `seek(time)` action; StemPlayer registers it as its own `handleSeek` (engine.seek + session autosave), and App's `handleSeek` now calls `transportActionsRef.current.seek(seekTime)` — so pointer/keyboard scrub on either Tab's spine drives the same `StemPlayerEngine` playhead. Keyboard seek (±5s, ±1s Shift, Home/End) and pointer scrub logic live in the untouched `MasterWaveform` component.
- Live playhead mirroring: `handleMixerChange` now also `setCurrentTime(mixer.currentTime)` (StemPlayer's position subscription already reported currentTime), so both spines and the Listen mono readout track playback in lockstep, not just seeks.
- New App seam asserts: ArrowRight on the Listen spine → `aria-valuenow "5"` on both spines; pointer scrub at 50% on the Mix spine → `"90"` on both; and `queryByRole("slider", …)` is null inside Separate/Export/System regions.

## Comments

- Design mandate satisfied without a new run: the ticket 01 Bold artifact already designs both — `data-od-id="master-spine"` (full canvas + "MASTER WAVEFORM SPINE · identical playhead on MIX" caption) in the Listen section and `data-od-id="spine-mini"` (900×84 canvas, "SHARED SPINE · playhead locked to Listen") in the Mix section. Preview: http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html
- The Mix mini-spine is gated with the Stem Player (only when separation completed) so pre-separation seams that query the master-waveform slider globally stay unambiguous; post-separation queries are region-scoped.
- Per-Stem waveform strips (`StemStrip`) and the Mix Tab's mute/solo/volume controls were untouched; the artifact's mini-spine caption ("playhead locked to Listen") is cosmetic in the mock and was intentionally not replicated as a separate DOM label.
