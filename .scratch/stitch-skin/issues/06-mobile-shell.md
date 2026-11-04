# 06: Mobile shell — screenshot stacking, Mix stage order at small widths

**What to build:** the whole app at mobile widths matching the screenshot's language: the Tab Band's stacked brand-over-chips block, the Mix stage keeping the mockup's order including Transport last, and the retuned density (shorter spine canvas, 2-col candidate chips, strip stack, cards). Below-md is no longer a different skin — it's the same skin, re-stacked.

**Blocked by:** 02 (Mix stage), 05 (System Tab — footer/band deaths settled before mobile stacking asserts flip).

**Status:** ready-for-agent

## Design source (agent-authored fallback — the mobile screenshot is authoritative where it and desktop disagree)

Per the mobile screenshot:

- **Tab Band**: brand block (mark + wordmark + status dot, no tagline) over the four centered Tab chips, one sticky block, tighter spacing than desktop; 44px chip targets survive.
- **Mix stage mobile order**: same order as desktop — shortened spine card, Hand Calibration lane, candidate chips in 2 columns (`grid-cols-2`), Transport card, Stem Strip stack, Time-Stretch card, Pitch-Shift card. **Transport stays the stage's last rail** even stacked (its card position follows the mockup's mobile reading order).
- **Separate/Export/System heads at mobile**: same Title-zone pattern at mobile type scale (mockup's pattern, not the grz vertical-rhythm sheet — that sheet dies with the skin).
- Density retune: reduced paddings/`space-y` values per screenshot; no behavior or copy changes.

## Checklist

- [ ] Sticky-block composition asserts in the app test retargeted (responsive precedent: class-token asserts, media queries unverifiable at DOM seam).
- [ ] Mix stage order asserts green at both breakpoints (single order contract in source, not breakpoint-duplicated markup).
- [ ] Candidate row 1/2/4 cols per breakpoint; `aria-pressed` lock survives.
- [ ] App green at 390/320 equivalent class asserts; no `md:`-only chrome left anywhere.

## Comments
