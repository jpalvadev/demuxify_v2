# 05: Increment verification + retired-affordances gate extension + record

**What to build:** the whole **Mix Rail Tidy-Up** increment is proven green as one piece: the retired-affordances gate now bans the two affordances this increment killed — the Click Track mute button and the Formant pill-slider markup — from shipped code, and the full pre-commit cycle passes end to end. Each of tickets 01–04 gets its port record appended.

**Blocked by:** 01, 02, 03, 04.

**Status:** resolved

- [x] The shipped-code ban list gains the two retired affordances (Click Track mute control, Formant pill-slider markers), tests and comments exempt exactly as the existing ADR-0011 accent/downbeat patterns already are — this can only land once 02 and 03 have killed the affordances, which is why it is blocked by them.
- [x] `check:testids`: every presence pin around the touched rails resolves; the retired pins (mute button, pill markup) are gone from the pin set.
- [x] `check:doc-anchors` green with the new ADR-0010 amendment span and the new ADR from ticket 04 in place; `check:glossary` green with the amended **Click Track** definition.
- [x] Full suite + typecheck green; suite count recorded on this ticket (357/357); the two existing Click Track export seams and the Stem Strip seam prove parity untouched (green without edits).
- [x] Append a port record (what landed, test deltas, gotchas) under Comments on tickets 01–04, and mark this ticket resolved with the final cycle output.

## Design decisions for this ticket

- The gate extension lives here, not in 02/03 (a widened gate run before the affordances die would fail by construction — the ban asserts absence).
- No ADR for the mobile flattening itself (settled in grilling Q12): cheap to reverse, nobody will be puzzled; the flattening's record is the spec + ticket 01.

**Branch:** mix-rail-tidy-up (new branch off `main` at porting start)

**Spec:** `.scratch/mix-rail-tidy-up/spec.md`

## Comments

- **Landed — this ticket (2026-11-02).** The `scripts/check-retired-affordances.mjs` ban list grew three entries beyond the ADR-0011 accent/Meter trio: the Click Track lane's mute symbols (`setClickTrackMuted|toggleClickTrackMute|handleToggleClickTrackMute` and the `clickTrack(State)?.muted` shape), the dead M button's rendered DOM (`aria-label="Mute Click Track"` — phrased to not touch the live Stem Strip M buttons), and the pill-slider markers (`translate-x-4|translate-x-5|ring-0`, verified by grep to appear nowhere in live src/ after ticket 02's kill — only in the tests' absence pins, which the gate exempts). The header comment records the two new retirements with their ADR pointers, and the guard's success line now names them.
- Port records appended under Comments on tickets 01 (`4fa6b9b`, 353→354), 02 (`d7bd115`, 354→355), 03 (`6f485c8`, 355→356), 04 (`9899430`, 356→357).
- Final cycle, all green:

```
check:glossary OK          check:doc-anchors OK       check:test-fixtures OK
check:testids OK           check:retired-affordances OK
✅ Retired affordances stay gone: no Downbeat axis, no Meter selector,
   no Click Track mute control, no Formant pill-slider in src/.
typecheck OK               suite: 357 passed / 357 (40 test files)
```

- Parity proofs standing green without edits: the two Click Track export seams (`ExportDialog.test.tsx` gating on `enabled` + Beat Grid) and the Stem Strip seam (live M/S controls, accessible names pinned at `StemPlayer.test.tsx:151`).
