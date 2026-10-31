# 07: Master Waveform as a shared spine

**What to build:** One shared Master Waveform spine belongs to the Tab Shell rather than to a player card: it renders identically in Listen and Mix at the exact same playhead position, so scrubbing in one Tab resumes at the identical spot in the other, and it is hidden in Separate, Export, and System. Click/pointer scrubbing, keyboard seek, and per-Stem waveform strips keep their existing interactions; canvas playhead rendering stays crisp on the near-black canvas.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] Single waveform instance shared across Listen and Mix; playhead position is identical when switching Tabs in either direction.
- [ ] Waveform absent from Separate, Export, System panels.
- [ ] App-level tests assert the shared-position behavior across Tab switches; Master Waveform test seam still green.
