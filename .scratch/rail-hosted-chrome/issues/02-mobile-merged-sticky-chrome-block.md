# 02: Mobile chrome merges into one sticky block

**What to build:** on mobile the brand lockup and the four Tab chips stop living in two separate strips and become a single **sticky top block** of the Tab Shell — a brand row over the chip row — so navigation and identity scroll as one unit and the stage starts below it. The mobile lockup is the **reduced** form: icon mark, wordmark, status dot, no tagline.

**Blocked by:** 01 (the Brand Unit and its lockup variants must exist first).

**Status:** ready-for-agent

- [ ] One sticky top block below md: brand row above the four-chip Tab row, both children of a single shell chrome block; no separate page-level header at any breakpoint once this lands.
- [ ] Brand row uses the reduced lockup — tagline dropped on mobile — keeping the pinned block near 108px total (≈44px brand row + ≈64px chip row) on a small-phone viewport.
- [ ] Chip row contracts untouched: four chips, 44px touch-target floors, hairline borders, gated reason lines, same strip behavior when Stems are absent.
- [ ] The block stays pinned while scrolling a long Separate Tab panel.
- [ ] No horizontal overflow reintroduced at 320 or 390 CSS px (the width constraints that keep narrow viewports from widening the document survive).
- [ ] App-level seam asserts the merged block through class tokens (sticky, single nav region) rather than media queries, following the rail-contract precedent.
- [ ] Verified visually with true-CSS mobile screenshots at 390 and 320 CSS px.
