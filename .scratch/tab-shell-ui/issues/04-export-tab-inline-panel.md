# 04: Export Tab — inline panel, no modal

**What to build:** Configuring an Export never opens an overlay: the Export Tab is a permanently visible panel carrying the full content model — Export Mode radio group (Single Stem / Export Bundle / Custom Mixdown), the active Pitch & Tempo adjustment option, stem picker, Custom Mixdown presets and per-Stem volumes with Master Volume and anti-clipping protection, WAV bit-depth vs MP3 bitrate selects, live encoding progress, success/error banners, and Export & Download actions. Encoding workers, bundling and mixdown DSP stay untouched.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] No `role="dialog"` / `aria-modal` / fixed full-screen overlay renders anywhere in the app while exporting.
- [ ] All export content reachable by clicking within the Export Tab; the player's waveform view is never hidden by export configuration.
- [ ] Download still saves the Export Bundle / Custom Mixdown file to the user's filesystem with the same options as before.
- [ ] The export test seam migrates from the dialog shape to the Tab panel shape and is green.
