# 06: Transport — dedicated Play / Pause buttons

**What to build:** The Listen Tab's Transport row replaces the single play/pause toggle pill with dedicated Play and Pause buttons plus a seek-to-start control and a mono time readout (current / total), styled as a real app transport. Spacebar play/pause and arrow-key seek (±5s, ±1s with Shift, Home/End) keep working exactly as before; scrubbing on the waveform is preserved. Playback engine behavior is untouched.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] Two distinct accessible Play and Pause buttons plus seek-to-start and mono time readout render in Listen.
- [ ] Spacebar, arrow-key and Shift-seek hotkeys still verified at the test seam.
- [ ] The Stem Player test seam asserts the two-button Transport and is green.
