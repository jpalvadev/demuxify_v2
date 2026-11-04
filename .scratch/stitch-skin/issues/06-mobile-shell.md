# 06: Mobile shell — screenshot stacking, Mix stage order at small widths

**What to build:** the whole app at mobile widths matching the screenshot's language: the Tab Band's stacked brand-over-chips block, the Mix stage keeping the mockup's order including Transport last, and the retuned density (shorter spine canvas, 2-col candidate chips, strip stack, cards). Below-md is no longer a different skin — it's the same skin, re-stacked.

**Blocked by:** 02 (Mix stage), 05 (System Tab — footer/band deaths settled before mobile stacking asserts flip).

**Status:** resolved

## Design source (agent-authored fallback — the mobile screenshot is authoritative where it and desktop disagree)

Per the mobile screenshot:

- **Tab Band**: brand block (mark + wordmark + status dot, no tagline) over the four centered Tab chips, one sticky block, tighter spacing than desktop; 44px chip targets survive.
- **Mix stage mobile order**: same order as desktop — shortened spine card, Hand Calibration lane, candidate chips in 2 columns (`grid-cols-2`), Transport card, Stem Strip stack, Time-Stretch card, Pitch-Shift card. **Transport stays the stage's last rail** even stacked (its card position follows the mockup's mobile reading order).
- **Separate/Export/System heads at mobile**: same Title-zone pattern at mobile type scale (mockup's pattern, not the grz vertical-rhythm sheet — that sheet dies with the skin).
- Density retune: reduced paddings/`space-y` values per screenshot; no behavior or copy changes.

## Checklist

- [x] Sticky-block composition asserts in the app test retargeted (responsive precedent: class-token asserts, media queries unverifiable at DOM seam).
- [x] Mix stage order asserts green at both breakpoints (single order contract in source, not breakpoint-duplicated markup).
- [x] Candidate row 1/2/4 cols per breakpoint; `aria-pressed` lock survives.
- [x] App green at 390/320 equivalent class asserts; no `md:`-only chrome left anywhere.

## Comments

### Port record (resolved in commit on branch stitch-skin)

- **Design source:** agent-authored fallback per spec.md mockups + the mobile screenshot (authoritative where mobile and desktop disagree); OpenDesign MCP forbidden this effort; recorded on this ticket.

- **Shell restack (the desktop defect):** `<main>` dropped `md:flex-row` — the Tab Band was a full-height row member beside the stage at md+, so its stretched grid + `rounded-full` chips exploded into viewport-tall pills (the screenshot's giant capsules). Main is now `flex flex-col gap-3 sm:gap-4 md:gap-5` at every width: band over stage, the single stacked shell from ticket 05's band composition.

- **Band density:** `py-2.5 pb-4 md:gap-1` -> `py-2 pb-3.5 sm:py-2.5 sm:pb-4 md:gap-2`; tighter at mobile per screenshot, relaxed up from sm. `grid grid-cols-4 items-stretch`, the 44px chip targets and the sticky/backdrop chrome unchanged.

- **Frames ruled everywhere:** the Stem Player root and the Time-Stretch & Pitch wrapper no longer hide their hairline until md — the `md:border md:border-border` birth pairs became base `border border-st-hairline` at every width. Below-md is the same skin, re-stacked, not a flatter one. Tempo/Pitch sub-boxes and the click-track rail already carried base borders; untouched.

- **Density retune (class tokens, no copy/behavior drift):** root `p-3.5 sm:p-5 space-y-5 sm:space-y-6`; wrapper `p-3 sm:p-4 space-y-3 sm:space-y-4`; transport row `gap-3 sm:gap-4 pb-3 sm:pb-4` with border-st-hairline; stem strip stack `gap-3 md:gap-4`; candidate grid 1/2/4 cols via `grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1`. MW canvas `height={84}` left alone — engine prop, not a skin knob.

- **Test flips:** the flattening test renamed to "rules the Stem Player outer frames at every width — below-md is the same skin, restacked"; its md-birth pins (`toContain("md:border…")` + base-border absence) flipped to base-rule pins (`toContain("border")` + `not.toMatch(/md:border/)`) plus the new density tokens. Band grid pin `md:gap-1` -> `md:gap-2`. Added candidate-picker column tokens (`grid-cols-1`, `sm:grid-cols-2`, `md:grid-cols-4`) to the click-track re-lock test; the `aria-pressed` lock pins survive untouched.

- **No md-only existence chrome left:** surviving `md:` tokens are density/restack only — band backdrop and gaps, candidate + strip column counts, transport row direction — plus the BrandUnit tagline `hidden md:block`, kept desktop-only deliberately (design source: the mobile lockup stays reduced).

- **Gates/suite:** glossary, doc-anchors, testids (65 presence pins), retired-affordances, test-fixtures, typecheck green; vitest 359/359.
