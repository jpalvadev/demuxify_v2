# 09: Bold skin port — tokens, dark-only, Stem quartet

**What to build:** The app takes on the Bold identity from ticket 01's design sheet without touching the shadcn-style HSL CSS-variable token architecture: retuned near-black canvas and surfaces, one acid-lime signature accent for primary actions and focus, heavy-contrast headings and section banners, the retuned high-contrast quartet applied consistently to Stem chips, waveform canvases and stem strips, and the header slimmed to branding plus a minimal state dot. Dark-only: the theme-toggle button and all light-theme token overrides are deleted, and the PWA manifest background/theme colors retune to the new canvas.

**Blocked by:** 01 (OpenDesign Bold design run).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] Every visible surface reads from retuned tokens (Tailwind token names unchanged); no hardcoded palette sprawl introduced.
- [ ] Theme toggle button and light-theme overrides removed app-wide; dark-only asserted at the test seam (no toggle control, no light class behavior).
- [ ] Stem quartet hues verified consistent across chips, waveform canvases, and stem strips (css-enabled tests can assert).
- [ ] PWA manifest colors and rendered shell match the design sheet; header branding follows the Bold type scale once ticket 10 lands.
