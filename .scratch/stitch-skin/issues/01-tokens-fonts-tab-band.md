# 01: Token ramp, fonts, and the Tab Band chrome

**What to build:** the new visual language's foundation — token ramp, ink scale, radii, self-hosted fonts, and the sticky **Tab Band** that replaces the desktop vertical rail column and the page-level header at every breakpoint. Composition of the four Tab stages happens later; this ticket lands with the app green at both breakpoints.

**Blocked by:** None (can start immediately).

**Status:** resolved

## Design source (agent-authored fallback — OpenDesign MCP forbidden this effort)

Design source: the user's Google Stitch Mix-Tab mockup + desktop/mobile screenshots, recorded here as the ported values (the images exist only in the originating conversation; these values are the contract):

- **Surfaces** (hex → register as a new named `st-*` ramp in the Tailwind config where the `grz` ramp lives; keep shadcn HSL CSS-variable architecture): canvas `#0e0e11` (body `#0d0d10`), panel `#141418`, surface `#18181f`, surface-light `#202028`, hairline border `#24242c`, border highlight `#32323e`.
- **Accent**: coral `#f85153`, hover `#ff6264`, muted wash `rgba(248,81,83,0.15)`. Retune `--primary` to coral; the acid-lime canvas marks retune in ticket 02's canvas constants.
- **Ink**: zinc-200 `#d1d5db` body text on the black surfaces; no surface may read the default Tailwind palette — add an ink scale if needed.
- **Ok status**: emerald ~`#34d399` (pip on the Transport status line).
- **Radii**: mockup is rounded — panels `rounded-lg`, chips `rounded` (base). Retune the config's radius scale (`--radius` is currently 0) and sweep `rounded-none` usages.
- **Fonts**: Inter (UI/display) + JetBrains Mono (mono), weights 400/500/600/700, subsetted woff2 self-hosted from the app's own font directory (same delivery mechanism as the current bundled faces). Never copy the mockup's Google Fonts CDN `<link>`s. Retarget the DISPLAY/MONO stacks in the typography module.
- **Custom slider CSS**: coral glowing 12px range-input thumbs + slim scrollbar, in the token layer of `src/index.css`.

## Checklist

- [x] `st-*` ramp + ink scale registered in the config; `grz`-family token usages retargeted or deleted; `check:retired-affordances` learns the `grz`/`grizzly` revival ban as of this commit.
- [x] Inter + JetBrains Mono subsets provisioned into the font directory; `@font-face` block retargeted; computed-style font asserts in the typography test move to the new stacks.
- [x] One sticky **Tab Band** at every breakpoint: merged top block (Brand Unit row over four centered Tab chips), never a `<header>` element (`queryByRole("header")` null at every width). Desktop vertical rail column dies; mobile merged sticky block becomes the only chrome.
- [x] Brand Unit lockup per mockup: coral rounded-square mark with white diamond glyph (replaces Waves icon), mixed-case bold Inter "Demuxify" `h1` + coral status dot, mono tagline desktop-only. Testids `brand-unit`, `brand-unit-status-dot` keep resolving.
- [x] Active Tab chip = solid coral pill with black ink; gated chips grayscaled + shipped one-line reason; 44px targets and `aria-disabled` survive.
- [x] Utility icons (undo/redo/gear) and engine-badge row: never rendered (drop list).
- [x] Radii retuned and `rounded-none` sweep done; suite green through the full pre-commit chain.

## Comments

- **Port record (ticket 01, committed on branch `stitch-skin`):** design source
  is the agent-authored fallback above (OpenDesign MCP forbidden this effort
  per spec). `tailwind.config.js` registers the `st-*` ramp (canvas/body/panel/
  surface/surface-light/hairline/highlight/coral/coral-hover/ink/ink-dim/ok/
  warn/waveform-box); the existing `stem-*`/`status-*` class names stay live
  with Stitch values in `src/index.css`. `--radius` retuned to `0.5rem` and
  the whole-src `rounded-none` sweep (261 usages) lands here. Fonts:
  `scripts/provision-stitch-fonts.mjs` → `public/fonts/stitch/` (Inter +
  JetBrains Mono variable latin woff2, `font-weight: 400 700`, `font-display:
block`); `public/fonts/grizzly/` deleted. Tab Band: nav `aria-label="Tab Band"`,
  `grid-cols-4` at every breakpoint, vertical rail column and 112px cells dead
  (the rail-cell test now pins `not.toMatch(/grid-cols-\[/`). Chips:
  `rounded-full`, gated keep `opacity-50` + `aria-disabled`. Gate gained the
  four 01-stage bans (grz ramp classes, grizzly-grid/pulse, fonts/grizzly
  urls, retired face names).
