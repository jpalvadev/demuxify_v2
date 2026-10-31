# 03: Tool relocation — every tool gets its Tab home

**What to build:** Every existing tool moves from the single-column card flow into its Tab, so the full product works end-to-end through the shell: **Separate** hosts Session Recovery, the Model Selector, the Source Mix dropzone and the Inference Engine progress card; **Listen** hosts the Master Waveform and transport; **Mix** hosts the four Stem strips with mute/solo/volume and the Time-Stretch / Pitch-Shift / Formant Preservation panel; **Export** hosts the Export controls (modal form still acceptable at this stage); **System** hosts the WebGPU status badge, Fallback Advisory, Model Cache status and the Diagnostics entry point. The whole separate→listen→export flow remains functional with no behavior changes to the underlying engines.

**Blocked by:** 02 (Tab Shell skeleton).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] Each Tab renders exactly its tool group; no tool remains in the old single-column flow.
- [ ] Full round trip works: pick Model Profile, ingest a Source Mix, run the Inference Engine, reach Separation Complete, play Stems, reach the Export controls.
- [ ] Gating from ticket 02 still correct: greyed Tabs become live the moment their tools' state allows.
- [ ] Existing per-component tests (Model Selector, Source Mix ingestion, Separation Progress, Session Recovery, Stem Player family) still green with components moved.
