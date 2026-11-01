# 02: Mobile chrome merges into one sticky block

**What to build:** on mobile the brand lockup and the four Tab chips stop living in two separate strips and become a single **sticky top block** of the Tab Shell — a brand row over the chip row — so navigation and identity scroll as one unit and the stage starts below it. The mobile lockup is the **reduced** form: icon mark, wordmark, status dot, no tagline.

**Blocked by:** 01 (the Brand Unit and its lockup variants must exist first).

**Status:** resolved

- [x] One sticky top block below md: brand row above the four-chip Tab row, both children of a single shell chrome block; no separate page-level header at any breakpoint once this lands.
- [x] Brand row uses the reduced lockup — tagline dropped on mobile — keeping the pinned block near 108px total (≈44px brand row + ≈64px chip row) on a small-phone viewport.
- [x] Chip row contracts untouched: four chips, 44px touch-target floors, hairline borders, gated reason lines, same strip behavior when Stems are absent.
- [x] The block stays pinned while scrolling a long Separate Tab panel.
- [x] No horizontal overflow reintroduced at 320 or 390 CSS px (the width constraints that keep narrow viewports from widening the document survive).
- [x] App-level seam asserts the merged block through class tokens (sticky, single nav region) rather than media queries, following the rail-contract precedent.
- [ ] Verified visually with true-CSS mobile screenshots at 390 and 320 CSS px.

## Comments

- `Header.tsx` deleted outright; App.tsx drops the `mobile-header-block` wrapper — the page opens straight into
  `<main>` at every breakpoint. The rail `<nav>` is the single shell chrome block: it now carries
  `sticky top-0 z-30 backdrop-blur-md bg-background/95` (the dead header's pinning treatment at base) plus
  `md:bg-card/50` so the desktop rail column keeps its exact previous appearance.
- Mobile merge needs no wrapper: the BrandUnit root gains `col-span-4`, so on the nav's base
  `grid grid-cols-4` the lockup owns row 1 (brand row) and the four chips auto-place on row 2; at md+
  `md:flex md:flex-col` the same child is the rail head, unchanged from ticket 01. Root is now
  `flex flex-col items-start gap-0 shrink-0 col-span-4 md:mb-2` (renders at all breakpoints).
- Reduced mobile lockup: tagline stays `hidden md:block` inside the lockup (block height stays
  ≈ py-2.5 + 44px brand + gap + 44px chips + pb-4 ≈ 110px). Per story 12 the System Tab now carries the
  mono identity line "Client-Side Stem Separation" (`font-mono text-xs text-muted-foreground`, mono stack inline)
  at the head of its panel body — inside the System region, never inside the `header-band` strip (System band chrome is out of scope).
- Seam: the branding test is retitled/retargeted to the merged block — single navigation region,
  `queryByRole("header")` null, `sticky`/`top-0`/`z-30` class tokens on nav, lockup free of display-gating
  tokens + `col-span-4`, tagline `md:block`, identity copy scoped within the System Tab region. Rail contract
  tests (4 buttons, 44px floors, grz-600/40 hairlines, 112px cell tokens) untouched — 36/36 App tests green + typecheck.
- Screenshot checkbox not claimable: no browser/screenshot tooling in this environment (no puppeteer/playwright);
  the 320/390 width-survival contract keeps the grz-02 `w-full`/`overflow-hidden` tokens on nav + stage untouched.
