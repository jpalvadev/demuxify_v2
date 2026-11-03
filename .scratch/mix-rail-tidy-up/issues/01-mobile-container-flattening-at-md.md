# 01: Mobile container flattening at `md` — the Mix stage paints one frame

**What to build:** below `md` (768 px) the Mix Tab stage of the **Stem Player** sits in exactly one frame — the **Tab Shell** stage panel. The Stem Player's own outer card border and the Time-Stretch & Pitch wrapper border die on mobile as class tokens; the Tempo/Speed and Pitch Transposition sub-boxes keep their frames, the **Click Track** rail keeps its bordered lane look, and the four **Stem Strips** are untouched at every viewport. At `md` and up the framed stage paints exactly as ported.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The Stem Player root region and the Time-Stretch wrapper region carry a border-bearing class token pair: bare below `md`, hairline only at `md` and up (grz-18 class-token precedent — the DOM seam cannot see media queries, so responsive truth is asserted through tokens).
- [x] Tab Shell stage panel, Click Track rail region, Tempo/Pitch sub-boxes, and Stem Strips keep their shipped class tokens verbatim at all viewports.
- [x] One breakpoint governs: the same `md` line the Tempo/Pitch two-column grid already flips on — no second `sm`-style pair is introduced (ADR-0009 lesson: a drifting pair reintroduces the drift it removed).
- [x] No padding, spacing, background, or token changes anywhere — only the border-bearing tokens at the two wrapper levels drop on mobile.
- [x] No testid dies: every pinned rail `data-testid` still resolves; `check:testids` green (this ticket removes no rail, only borders).
- [x] Whole-app DOM seam asserts the flattening tokens and the untouched sub-boxes/rails; full pre-commit check cycle green.

## Design decisions for this ticket

- Two class-token edits inside the Stem Player component (root region + wrapper region); everything else is test assertions. Anchor edits with the outline map — this file is 1,100+ lines (AGENTS.md big-file steering).
- Sub-boxes stay framed deliberately (settled in grilling Q1): they are the functional grouping, not a wrapper; anyone tempted to flatten them later re-opens the design tree.

**Branch:** mix-rail-tidy-up (new branch off `main` at porting start)

**Spec:** `.scratch/mix-rail-tidy-up/spec.md`

## Comments

- **Ported — commit `4fa6b9b` (2026-11-02).** What landed: two class-token edits inside `src/components/StemPlayer.tsx` — the card root (`md:border md:border-border`) and the Time-Stretch & Pitch wrapper (`md:border md:border-border/60`) — flipping on the same `md` line the Tempo/Pitch grid already uses; every other token verbatim, sub-boxes/rail/Strips untouched. Test delta: suite 353→354 — one whole-app class-token seam test (presence of the `md:` pairs, absence of the bare `border`/`border-border` standalone tokens; grz-18 precedent). Gotchas: class-token tests pin tokens, not pixels — the DOM seam cannot evaluate media queries (noted above the test); both edits anchored with grep line numbers per big-file steering.
