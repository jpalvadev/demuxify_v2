# 05: Increment verification + retired-affordances gate extension + record

**What to build:** the whole **Mix Rail Tidy-Up** increment is proven green as one piece: the retired-affordances gate now bans the two affordances this increment killed — the Click Track mute button and the Formant pill-slider markup — from shipped code, and the full pre-commit cycle passes end to end. Each of tickets 01–04 gets its port record appended.

**Blocked by:** 01, 02, 03, 04.

**Status:** ready-for-agent

- [ ] The shipped-code ban list gains the two retired affordances (Click Track mute control, Formant pill-slider markers), tests and comments exempt exactly as the existing ADR-0011 accent/downbeat patterns already are — this can only land once 02 and 03 have killed the affordances, which is why it is blocked by them.
- [ ] `check:testids`: every presence pin around the touched rails resolves; the retired pins (mute button, pill markup) are gone from the pin set.
- [ ] `check:doc-anchors` green with the new ADR-0010 amendment span and the new ADR from ticket 04 in place; `check:glossary` green with the amended **Click Track** definition.
- [ ] Full suite + typecheck green; suite count recorded on this ticket; the two existing Click Track export seams and the **Stem Strip** seam prove parity untouched (green without edits).
- [ ] Append a port record (what landed, test deltas, gotchas) under Comments on tickets 01–04, and mark this ticket resolved with the final cycle output.

## Design decisions for this ticket

- The gate extension lives here, not in 02/03 (a widened gate run before the affordances die would fail by construction — the ban asserts absence).
- No ADR for the mobile flattening itself (settled in grilling Q12): cheap to reverse, nobody will be puzzled; the flattening's record is the spec + ticket 01.

**Branch:** mix-rail-tidy-up (new branch off `main` at porting start)

**Spec:** `.scratch/mix-rail-tidy-up/spec.md`
