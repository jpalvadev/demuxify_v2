# 03: Tool relocation — every tool gets its Tab home

**What to build:** Every existing tool moves from the single-column card flow into its Tab, so the full product works end-to-end through the shell: **Separate** hosts Session Recovery, the Model Selector, the Source Mix dropzone and the Inference Engine progress card; **Listen** hosts the Master Waveform and transport; **Mix** hosts the four Stem strips with mute/solo/volume and the Time-Stretch / Pitch-Shift / Formant Preservation panel; **Export** hosts the Export controls (modal form still acceptable at this stage); **System** hosts the WebGPU status badge, Fallback Advisory, Model Cache status and the Diagnostics entry point. The whole separate→listen→export flow remains functional with no behavior changes to the underlying engines.

**Blocked by:** 02 (Tab Shell skeleton).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] Each Tab renders exactly its tool group; no tool remains in the old single-column flow.
- [x] Full round trip works: pick Model Profile, ingest a Source Mix, run the Inference Engine, reach Separation Complete, play Stems, reach the Export controls.
- [x] Gating from ticket 02 still correct: greyed Tabs become live the moment their tools' state allows.
- [x] Existing per-component tests (Model Selector, Source Mix ingestion, Separation Progress, Session Recovery, Stem Player family) still green with components moved.

## Answer

Commit `2729644` — `feat(tab-shell-ui): ticket 03 — relocate every tool into its Tab home with app-level Export panel bridge`. Full suite green (37 files / 282 tests), including 3 new App-level seams.

Relocation (App.tsx stage rewritten, handler/state machine untouched):

- **Separate Tab**: Session Recovery, Model Selector, Source Mix dropzone, Inference Engine progress card (unchanged internals).
- **Listen Tab**: hosts the shared `MasterWaveform` spine whenever `waveformPeaks && decodedSourceMix` — greyed with "no Stems yet" until then; the Separate panel no longer contains any waveform.
- **Mix Tab**: hosts `StemPlayer` (four Stem strips, mute/solo/volume, Time-Stretch / Pitch-Shift / Formant Preservation, transport) once stems are ready.
- **Export Tab**: hosts the app-level `ExportDialog` panel. StemPlayer gained an export bridge: optional props `onExportDialogOpen(state)` / `onExportDialogState(state)` with exported type `ExportDialogState {mixerStates, masterVolume, timeStretch}`; every mixer + time-stretch handler re-emits live state via `emitExportDialogState()` (engine getters `getTempo`/`getPitch`/`isFormantPreservationEnabled`). The "Export Stems" action is dual-mode: with the bridge it opens the Export Tab panel; without it StemPlayer keeps its legacy internal ExportDialog — so the per-component `StemPlayer.test.tsx` export seam stays untouched and green.
- **System Tab**: `WebGPUStatusBadge` + `FallbackAdvisory` + `DiagnosticsOverlay` moved out of the Header/floating-root positions into the System panel DOM (still modal-styled; reshaped in ticket 05). `Header.tsx` trimmed to theme props only.
- Active-Tab focus stays derived (Separate → Listen on completion); panels never `hidden`; gating copy (`TAB_GATING_REASON`) preserved.

New App seams assert: dropzone/Remove-Source-Mix lives in the Separate Tab region, the Master Waveform slider within the Listen Tab region, the Stem Player region within the Mix Tab region, the WebGPU badge text within the System Tab region, and the Export panel mounts inside the Export Tab region on "Export Stems" click (Close removes it) with live mixer state mirrored (Drums 0.4 fader + Vocals muted before opening → Custom Mixdown sliders/checkboxes mirror).

## Comments

- Design mandate satisfied without a new run: the ticket 01 OpenDesign Bold artifact (`demuxify-tab-shell`, run `378f15f6-3cc6-404d-896e-f0f6a8aaf9e7`) already renders the five-tab tool-relocation view this ticket needs — preview: http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html. Tokens/layout are ported in tickets 09/10.
- Export panel keeps its modal styling (`fixed inset-0`, `role="dialog"`, `aria-modal`) at this stage per the ticket text ("modal form still acceptable"); ticket 04 reshapes it inline.
- Model Cache status stays surfaced by the Inference Engine card in the Separate Tab; the System Tab gains its own cache-status surfacing in ticket 05.
- Post-resolve fix (commit `bc567da`): the Tab stage now matches the artifact's `.stage`/`.panel`/`.panel.act` contract — panels stay pinned in the DOM but the stage paints ONLY the active Tab panel (`absolute inset-0 overflow-y-auto` when active, `hidden` otherwise), instead of stacking all five in-flow. Engine/state bridges are untouched; hidden panels still render, so every relocation seam stays green.
