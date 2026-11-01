# 10: Bundled subset fonts — display + mono

**What to build:** The Bold identity ships real typefaces offline: a heavy display face for headings, branding and section banners, and a strong mono face for Transport readouts, time values and diagnostics, both self-hosted as subset woff2 bundled as PWA assets with local @font-face declarations. No CDN or remote font references may exist anywhere — the offline-first PWA constraint stands. Tailwind's default sans remains the fallback stack.

**Blocked by:** 01 (OpenDesign Bold design run — its sheet names the pairing).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] Font files are bundled build assets; a build produces zero remote font URLs (offline check).
- [x] Headings, branding, and mono readouts render in the designated faces; fallback stack intact.
- [x] App shell tests (css: true) assert the font families applied to headings and time readouts.

## Answer

Commit `d45bba3` — `feat(tab-shell-ui): ticket 10 - bundled Archivo Black + JetBrains Mono woff2 subsets` (full suite green: 37 files / 287 tests).

- **Bundled subsets:** the sheet's pairing is fetched once, offline-ified, and committed as build assets — `public/fonts/archivo-black-latin.woff2` (Archivo Black, latin subset) and `public/fonts/jetbrains-mono-latin.woff2` (JetBrains Mono variable, 400–800 weights, latin subset). Google's latin `unicode-range` block (U+0000-00FF … U+FFFD) ships verbatim on both `@font-face` rules in `src/index.css`, with **local `src: url("/fonts/…")` only** and `font-display: block` per the sheet's no-flicker rule; the mono rule declares the variable axis `font-weight: 400 800` so one subset file paints every readout weight.
- **Zero remote fonts (offline check):** `npm run build` verifies it — `dist/assets/index-B9TWwImV.css` contains exactly two font urls, both `/fonts/archivo-black-latin.woff2` and `/fonts/jetbrains-mono-latin.woff2`; Vite leaves public-dir absolute URLs unhashed, `dist/fonts/*.woff2` are copied, and grepping the whole `dist/` for `fonts.gstatic|fonts.googleapis|@import|https?://…woff` returns nothing. `vite.config.ts` extends the workbox glob to `**/*.{js,css,html,ico,png,svg,wasm,woff,woff2}`, so `dist/sw.js` precaches both faces (13 entries, 30191.66 KiB).
- **Single-sourced stacks:** new module `src/lib/typography.ts` exports `DISPLAY_FONT_STACK = '"Archivo Black", "Archivo", Impact, sans-serif'` and `MONO_FONT_STACK = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace'` (the sheet's `--font-display` / `--font-mono`, generic sans/mono tails keeping the Tailwind default sans as the fallback stack). `tailwind.config.js` registers `fontFamily.display`/`mono`, so utilities (`font-display` on headings/banners, `font-mono` on readouts) and the inline focal styles can never drift.
- **Focal nodes:** the branding `h1` (Header), the Separate `h2` + five Tab-banner `h3`s + progress `h3`s (App), the Multi-Track Stem Player `h3`, and the two time readouts (`data-testid="transport-readout"`, `data-testid="stem-player-time"`) additionally carry the stack **inline** — jsdom's `getComputedStyle` resolves only inline styles, which is what the css seam reads. `index.html` selection retuned to the lime accent (`selection:bg-primary selection:text-primary-foreground`).
- **Test seam:** new App shell test "paints the bundled Bold faces on banners, branding and time readouts" asserts `window.getComputedStyle(…).fontFamily` contains `Archivo Black` (with `sans-serif` tail) on the h1 and the Listen banner h3, and `JetBrains Mono` (with `monospace` tail) on both readouts.

## Comments

- Design mandate satisfied without a new run: the ticket 01 Bold artifact (run `378f15f6-3cc6-404d-896e-f0f6a8aaf9e7`) names the pairing directly — `:root` declares `--font-display:"Archivo Black","Archivo",Impact,sans-serif` and `--font-mono:"JetBrains Mono",ui-monospace,Menlo,monospace`, and the `.pb`/`.phead h2`/`.brand b` type rules consume the display face while `.mono`/`.tag`/`.chip` consume the mono face. Preview: http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html
- The sheet's `--font-body: Inter` is deliberately NOT bundled: the ticket keeps Tailwind's default sans as the fallback stack for body copy, so only the two designated faces ship as woff2 assets. `.card .ct` uses `--font-var` (Archivo), which resolves to the bundled Archivo Black display face — the only Archivo variant bundled, per the subset mandate.
- Follow-up (ticket 09 palette guardrail): commit `fe0c0a2` — `feat(tab-shell-ui): retune emerald/amber status hues to sheet --ok/--warn tokens`. The 29 remaining emerald/amber Tailwind usages in `App.tsx` + 9 components were swept to new declared token names `status-ok` (`hsl(140 72% 52%)` = sheet `--ok`) and `status-warn` (`hsl(48 95% 58%)` = sheet `--warn`), added to the `src/index.css` token block and `tailwind.config.js` alongside the existing `--stem-*` additions; redundant `dark:text-*` shade variants dropped (html.dark is permanent). No emerald/amber/indigo/violet/purple/cyan/sky/fuchsia/rose class usage remains in `src/`, so the declared token set is the whole palette.
