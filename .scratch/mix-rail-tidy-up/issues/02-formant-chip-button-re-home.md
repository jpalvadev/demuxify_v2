# 02: Formant control re-home — pill-slider dies, Mic chip button born

**What to build:** the **Vocal Formant Preservation** control stops being a shadcn-style pill-slider whose white knob overhangs the panel border on mobile, and becomes a member of the existing square rail-button family: one tap flips it, pressed = on, unpressed = off, Mic icon, sitting inline on its label row inside the Pitch Transposition box so no part of it can ever leave the frame. Switch semantics survive: assistive tech still hears one switch with an announced on/off state.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The pill-slider element (track span + translating knob span) dies outright; no pill-slider markup marker survives in shipped code.
- [x] Replacement button uses the rail-button family treatment verbatim (the pressed/unpressed token pair the ♪/M/S squares already use): `h-8`-style square, `rounded-none border`, pressed = primary-filled.
- [x] Button keeps `role="switch"` + `aria-checked`, accessible name "Vocal Formant Preservation", and the Mic glyph (the same icon the **Stem** Strips use for Vocals — zero new visual language).
- [x] One press flips **Formant Preservation** at the engine seam exactly as before; the readout, Session persistence, and export parity of the preservation flag are untouched.
- [x] Stem Player component seam asserts the button's name/role/glyph; the whole-app seam asserts the pill markup's absence in the composed Mix stage.
- [x] Full pre-commit check cycle green.

## Design decisions for this ticket

- Re-home, not a design run (settled in grilling Q11): every part of the affordance — square button tokens, Mic icon — already ships in the rail family, so the OpenDesign mandate stays in its removals-and-re-home exception (ADR-0008/ADR-0009 precedent). Recorded here on the ticket.
- The "Vocals Stem" copy chip beside the label stays verbatim; only the control to its right changes.
- The pill markup's death is what the retired-affordances gate will later ban — ticket 05 extends that gate only after this lands.

**Branch:** mix-rail-tidy-up (new branch off `main` at porting start)

**Spec:** `.scratch/mix-rail-tidy-up/spec.md`

## Comments

- **Ported — commit `d7bd115` (2026-11-02, amended for the honest count).** What landed: the Formant pill-slider died outright in `StemPlayer.tsx` (~1018-1037) and re-homed as the square rail-button chip family (`h-8 w-8 rounded-none border`, pressed/unpressed token pair verbatim from the ♪/M/S chips) wearing the `Mic` glyph (added to the lucide imports) inline on its label row; `role="switch"` + `aria-checked` + accessible name "Vocal Formant Preservation" preserved; the "Vocals Stem" chip stayed verbatim. Test delta: suite 354→355 — extended the component seam test in `stemPlayerTimeStretch.test.tsx` (family tokens, svg=1/span=0 knob death, no `translate-x|ring-0|cursor-pointer`) plus a new `App.test.tsx` test pinning pill-marker absence via `document.querySelectorAll('[class*="translate-x-4"]'…)` and the untouched Vocals chip. Gotchas: vitest 2.1.3 has no chai `notToMatch` property — use `expect(x).not.toMatch(/…/)`; no OpenDesign run (removal + re-home into an existing family, MCP daemon dead that session per the documented fallback).
