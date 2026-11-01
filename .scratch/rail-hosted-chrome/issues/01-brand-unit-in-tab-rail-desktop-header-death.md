# 01: Brand Unit in the Tab Rail — desktop header dies

**What to build:** at md and up there is no page-level header anymore; the page opens straight into the Tab Shell, and the **Brand Unit** (icon mark, `DEMUXIFY` display wordmark, status dot, mono tagline) sits at the head of the Tab Rail above the four Tab chips. Below md nothing changes yet — the header keeps rendering there until ticket 02 merges it into the mobile block, so the app stays green at both breakpoints when this ticket lands.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] No page-level header element in the composition at md and up; the Tab Rail is the only top-level chrome there.
- [x] Brand Unit renders once, as the first thing in the Tab Rail: icon mark in its existing bordered box left of the wordmark, `DEMUXIFY` display wordmark with the 8px pulsing status dot after it, and the mono tan tagline on its own line beneath.
- [x] Lockup is flush on the canvas — no new bordered card around it, since the rail chips already own the rail's borders — with ~16px of air (not a rule) before the `SEPARATE` chip.
- [x] Tagline is part of the rail lockup; the wordmark remains the document's single top-level heading.
- [x] Rail geometry untouched: rail widths (250px at md, 280px at lg), its vertical hairline divider, and every chip contract (hairline border, chrome-0 corners, 44px touch-target floor, gated reason line) still assert green.
- [x] App-level seam: the branding test is retargeted (not rewritten) to the rail Brand Unit; the Bold-face assertion on the top-level heading still resolves to the bundled display subset.
- [ ] Verified visually with a true-CSS desktop screenshot: no header band, brand sitting over the rail chips.

## Comments

- `BrandUnit` lockup is the first child of the Tab Rail `<nav>`: `hidden md:flex flex-col md:mb-2` root (flush, no card —
  air before `SEPARATE` is the rail's `md:gap-2.5` plus the lockup's `md:mb-2`, ~18px of space, no rule). Icon box
  (`h-9 w-9` bordered, Waves glyph) left of the `h1` wordmark (inline `DISPLAY_FONT_STACK`), 8px `bg-primary grizzly-pulse`
  status dot (`data-testid="brand-unit-status-dot"`) after the wordmark, mono tagline `Client-Side Stem Separation`
  (`hidden md:block`) on its own line beneath.
- Header stays rendering below md via wrapper `<div data-testid="mobile-header-block" className="md:hidden"><Header /></div>`;
  deleted outright at ticket 02. The two branches never display together (BrandUnit is `hidden` below md), so exactly one
  `h1` renders at every breakpoint even though both exist in the DOM mid-increment — heading assertions scoped `within(brand)`.
- Seam: branding test retargeted to `within(rail).getByTestId("brand-unit")` with class-token assertions (`md:flex` lockup,
  `md:hidden` mobile-header-block) per the grz-18 precedent that the DOM seam cannot evaluate media queries; typography
  test's h1 assertion now scoped to the rail Brand Unit. Rail `<nav>` className and all chip contracts untouched — 36/36
  App tests green + `npm run typecheck`.
- Screenshot checkbox not claimable: this environment has no browser/screenshot tooling (no puppeteer/playwright),
  so the visual verification is asserted through the DOM/class-token seam only.
