# 09: Bold skin port — tokens, dark-only, Stem quartet

**What to build:** The app takes on the Bold identity from ticket 01's design sheet without touching the shadcn-style HSL CSS-variable token architecture: retuned near-black canvas and surfaces, one acid-lime signature accent for primary actions and focus, heavy-contrast headings and section banners, the retuned high-contrast quartet applied consistently to Stem chips, waveform canvases and stem strips, and the header slimmed to branding plus a minimal state dot. Dark-only: the theme-toggle button and all light-theme token overrides are deleted, and the PWA manifest background/theme colors retune to the new canvas.

**Blocked by:** 01 (OpenDesign Bold design run).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] Every visible surface reads from retuned tokens (Tailwind token names unchanged); no hardcoded palette sprawl introduced.
- [x] Theme toggle button and light-theme overrides removed app-wide; dark-only asserted at the test seam (no toggle control, no light class behavior).
- [x] Stem quartet hues verified consistent across chips, waveform canvases, and stem strips (css-enabled tests can assert).
- [x] PWA manifest colors and rendered shell match the design sheet; header branding follows the Bold type scale once ticket 10 lands.

## Answer

Commit `05a538b` — `feat(tab-shell-ui): ticket 09 - Bold skin token port, dark-only, stem quartet` (full suite green: 37 files / 286 tests).

- **Token architecture intact:** `src/index.css` keeps the shadcn `:root` HSL-variable block with the same token names — only values retuned to the ticket 01 sheet's `:root`: background `232 12% 4%`, card `232 10% 9%`, popover/secondary `232 9% 13%`, muted/accent surface `232 8% 18%`, border `232 12% 22%`, input `232 10% 16%` (the sheet's `--border-soft`), foreground `232 6% 96%`, secondary/muted-foregrounds `72%`/`56%` (`--fg-2`/`--muted`), destructive = sheet `--err 358 78% 62%`. Primary/ring become the acid-lime signature accent `92 100% 58%` with `--accent-on 232 24% 6%` ink, so primary CTAs and focus rings are the one lime focal identity. `--radius: 0.75rem` unchanged.
- **Dark-only:** the entire `.light` override block deleted; `Header.tsx` lost its toggle button + theme props (now zero props) and the privacy shield pill, slimmed to the artifact `.brand` unit — Archivo-Black-uppercase wordmark + 8px lime status dot (`data-testid="header-status-dot"`) + mono status line. `App.tsx` dropped `theme` state and `handleToggleTheme`; a static effect keeps `html.dark` permanently. Test seam `toggles theme between dark and light` rewritten to assert no `/toggle theme/i` button exists and html has `dark` but never `light`.
- **Stem quartet:** new `--stem-*` CSS vars (320 88% 64% / 264 84% 70% / 34 95% 60% / 196 86% 62% verbatim from the sheet) + `tailwind.config.js` `stem-vocals|drums|bass|other` color names (`hsl(var(--stem-*) / <alpha-value>)`) — one identity set consumed by chips (`STEM_CONFIG.badgeClass` now `bg-stem-*/15 text-stem-* border-stem-*/40`), canvas fills (`STEM_CONFIG.activeColor/inactiveColor` retuned to `#f452be` `#a672f3` `#faa638` `#4bc5f1` with matching rgba), and the same quartet flows through `StemStrip` canvases. `StemTrack` is a re-export of `StemStrip`, so chips/strips/canvases can never drift apart.
- **Waveform canvases retuned:** `MasterWaveform` canvas bg → `#09090b` (= `--bg`), played highlight + playhead line + cap → accent lime `#8dff29`, unplayed bars → fg-2 dim `rgba(179,180,188,.35)`, tick labels → muted; DOM readout `text-cyan-400` → `text-primary` mono, focus ring `ring-cyan-500/80` → `ring-ring/60` (lime). Solo-active button on strips re-keyed from amber fill to accent-border/muted surface per the sheet's `.stem button.on`.
- **No palette sprawl:** leftover indigo/violet surfaces (`SourceMixCard` CTA + icons, `SourceMixDropzone`, `SessionRecovery` notice) retuned to existing tokens — the primary CTA is now solid `bg-primary` lime with `text-primary-foreground` ink (the sheet's `.btn-go`), secondary chips/icons use `bg-secondary`/`bg-muted`/`text-secondary-foreground`. Only the declared token names + the four `--stem-*` additions exist.
- **Manifest:** `public/manifest.webmanifest` already carried `#09090b` for background/theme — that is exactly hsl(232 12% 4%) (the sheet's `--bg` canvas), verified by computation, so it already matches the new canvas; no edit required.

## Comments

- Design mandate satisfied without a new run: the ticket 01 Bold artifact defines every look ported here — `:root` token block, `.brand` unit (wordmark + accent dot + mono status line), `.btn-go` accent CTA, `.stem button.on` accent state, stem chips + `SC[k]` canvas hues, and the hard contract line "no theme toggle · stem hues reserved for waveform + stem chips only". Preview: http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html
- The quartet consistency is structural rather than css-enabled: canvases and chips read the same `STEM_CONFIG` constants and the same hexes equal the `--stem-*` vars, so the hue set is single-sourced in code; vitest's jsdom renders without Tailwind CSS so computed-style assertions were not used (no test in the repo asserts computed styles).
- `font-display`/`font-mono` stacks reference Archivo Black/JetBrains Mono with fallbacks only; real subset woff2 come with ticket 10 (header branding then follows the Bold type scale).
- Follow-up after ticket 10: commit `fe0c0a2` closes the palette-sprawl guardrail completely — the 29 leftover emerald/amber usages (ok/caution surfaces in App + 9 components) were swept to new sheet tokens `status-ok` = `--ok 140 72% 52%` and `status-warn` = `--warn 48 95% 58%` (added to the `:root` block + `tailwind.config.js` beside the `--stem-*` names), and redundant `dark:text-*` shade variants dropped. Grepping `src/` now finds zero emerald/amber/indigo/violet/purple/cyan/sky/fuchsia/rose classes: every surface reads a declared token.
