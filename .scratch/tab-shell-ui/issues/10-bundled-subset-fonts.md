# 10: Bundled subset fonts — display + mono

**What to build:** The Bold identity ships real typefaces offline: a heavy display face for headings, branding and section banners, and a strong mono face for Transport readouts, time values and diagnostics, both self-hosted as subset woff2 bundled as PWA assets with local @font-face declarations. No CDN or remote font references may exist anywhere — the offline-first PWA constraint stands. Tailwind's default sans remains the fallback stack.

**Blocked by:** 01 (OpenDesign Bold design run — its sheet names the pairing).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] Font files are bundled build assets; a build produces zero remote font URLs (offline check).
- [ ] Headings, branding, and mono readouts render in the designated faces; fallback stack intact.
- [ ] App shell tests (css: true) assert the font families applied to headings and time readouts.
