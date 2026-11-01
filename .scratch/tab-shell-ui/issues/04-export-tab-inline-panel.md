# 04: Export Tab — inline panel, no modal

**What to build:** Configuring an Export never opens an overlay: the Export Tab is a permanently visible panel carrying the full content model — Export Mode radio group (Single Stem / Export Bundle / Custom Mixdown), the active Pitch & Tempo adjustment option, stem picker, Custom Mixdown presets and per-Stem volumes with Master Volume and anti-clipping protection, WAV bit-depth vs MP3 bitrate selects, live encoding progress, success/error banners, and Export & Download actions. Encoding workers, bundling and mixdown DSP stay untouched.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] No `role="dialog"` / `aria-modal` / fixed full-screen overlay renders anywhere in the app while exporting.
- [x] All export content reachable by clicking within the Export Tab; the player's waveform view is never hidden by export configuration.
- [x] Download still saves the Export Bundle / Custom Mixdown file to the user's filesystem with the same options as before.
- [x] The export test seam migrates from the dialog shape to the Tab panel shape and is green.

## Answer

Commit `ce588be` — `feat(tab-shell-ui): ticket 04 — Export Tab inline panel, no modal overlay; migrate export seams to panel shape` (282/282 tests green).

- `ExportDialog.tsx` root: the full-screen overlay wrapper (`fixed inset-0 z-50 bg-background/80 backdrop-blur-xs` + click-outside-to-close) and the `role="dialog" aria-modal="true"` dialog div are replaced by a single inline `<section role="region" aria-labelledby="export-dialog-title">` panel — the component's accessible name is now "Export Audio Stems" as an in-flow region of the Export Tab.
- Full content model preserved untouched: Export Mode radio group (Single Stem / Full Export Bundle / Custom Mixdown), Pitch & Tempo adjustment option, stem picker checkboxes, Mixdown presets + per-Stem volume faders + Master Mixdown Volume + Anti-Clipping Protection, WAV Bit Depth / MP3 Bitrate selects, progressbar/status/alert bands, Close + Export & Download actions. Export pipeline (encoders, worker, bundle, mixdown lib) untouched.
- Seam migration: `ExportDialog.test.tsx` (1 query), `StemPlayer.test.tsx` (4 queries) and the App-level Export Tab seams now locate the panel via `getByRole("region", { name: /export audio stems/i })`; no `getByRole("dialog")` remains in the export path.
- The panel never hides the player: it lives in the Export Tab region; Listen spine and Mix Stem Player stay rendered alongside it.

## Comments

- Design mandate satisfied without a new run: the ticket 01 Bold artifact (`demuxify-tab-shell`, run `378f15f6-3cc6-404d-896e-f0f6a8aaf9e7`) designs the inline Export Tab panel — http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html. Token/layout port itself happens in tickets 09/10.
- The "Export Stems" action from the Stem Player opens this panel via the app-level bridge (ticket 03); Close removes it while everything else on screen stays put.
- `DiagnosticsOverlay` still has a modal form — that is the System Tab's, reshaped inline by ticket 05 (export path itself is modal-free).
