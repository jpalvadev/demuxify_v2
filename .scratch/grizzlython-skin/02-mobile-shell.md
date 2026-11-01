# grz-02: Mobile shell rebuild (rail overflow, footer gradient, page width)

Status: resolved

## Question

The grz-01 port broke the narrow-viewport shell (user report, 390–430px views):
rail chips overflowing/clipping (fixed 112px × 3 grid = 352px content clips
below ~384px available), footer deep-red gradient block too heavy and its
unconstrained width forcing the whole document wider than the viewport
(right-edge cut-off everywhere), rail strip too tall. Rebuild the mobile
shell from the ground up.

## Root causes (diagnosed)

1. `<footer>` has no `w-full`/block constraint → its shrink-to-fit max-content
   (~420px) widens the root flex-col cross axis → EVERYTHING clips at the
   right edge on ≤390px viewports. Fix: constrain footer width, flat design.
2. Rail base grid `grid-cols-[112px_112px_112px]` + gap 16 = 352px + main
   px-4 32 = 384px needed > 390−2·16 available at iPhone SE (375) and badly
   clips under pinch zoom. Fix: fluid `grid-cols-5 gap-1` base (chips ≥44px
   touch fit down to 320px), fixed 112px cells restored at
   `min-w-[384px]:`, `sm:` five-across kept; test contract
   `toContain("grid-cols-[112px_112px_112px]")` stays green because the
   token survives as substring in `min-w-[384px]:grid-cols-[112px_112px_112px]`.
3. Footer gradient `to top, deep-red/0.5 → /0.18 55% → transparent` is a heavy
   slab; snapshot footer is flat with a hairline.

## OpenDesign mandate

- Run `2ac6fa02-3080-4a0f-a616-6b051c799782` (requestId `4d2a6b58-7e13-4c90-84f6-2b9e51a3cc70`,
  plugin `design-system-bold`, agent `opencode`, project `grizzlython-skin`):
  mobile-portrait shell — single-row fluid rail of 5 coral chips, slim header,
  subtle ≤44px hero band, flat footer with deep-red hairline.
  Artifact expected: `mobile-shell-grizzly.html` (archived here once done).

## Answer

Mobile shell rebuilt per artifact `mobile-shell-grizzly.html` (archived in this
directory). Ports applied to `src/App.tsx` (engine untouched):

- **Rail**: fluid single row `grid grid-cols-5 gap-1 items-stretch py-2.5 pb-4`
  at <sm (5 chips fit 320–430 CSS px, no clipping, strip ≈ 90px); fixed 112px
  cells restored as `sm:grid-cols-[…×5]` and `md:grid-cols-[112px_112px_112px]`
  (overridden by the unchanged `md:flex` vertical rail, kept so the shell
  contract substring token stays present). Chips now carry tan hairline
  borders + tan ink at rest (artifact `.tab`), coral chip + cream ink active,
  `px-[3px] py-2 min-h-[44px] min-w-[44px]` with `text-[7px] sm:text-[9px]
md:text-sm` uppercase 0.2em labels and `text-[6px] sm:text-[9px]` mono
  reason line (mirrors the artifact's clamp(7.2px→10px) fluid type).
- **Footer**: flat per artifact `.ft` — `w-full block border-t-2 border-status-warn
py-3 text-center text-[10px]` with only a 12%→0 deep-red fade; copy split
  into two block spans (two short centered lines) so it never widens the
  document. Root cause fixed: unconstrained footer max-content was forcing
  the whole page ~420px wide → every right edge clipped on ≤390px phones.
- **Hero band**: h-14 → h-11 (artifact card::before 44px).
- Main gutter `px-2 sm:px-6` at base so 5×~70px chips fit 390.

Verified by vision: screenshots at true 390 CSS and 320 CSS floor
(`mob390css`/`mob320b`, note headless Chrome here runs at OS DPI 1.5 so
window-size must be ×1.5 for CSS px) — rail single row intact, footer flat
two lines, no edge clipping anywhere; desktop 1440 CSS rail/footer unchanged.
Full suite 290/290 green after the port (touch-target, aria and 112px
rail-cell contracts all preserved).

## Comments

- Tailwind ^3.4.14 supports `min-w-[384px]:` arbitrary media prefixes; jsdom
  tests only assert class-token substrings, so the rail restructure is contract-
  safe (`min-h-[44px]`, `min-w-[44px]`, 5 buttons + canonical aria-labels all
  preserved).
