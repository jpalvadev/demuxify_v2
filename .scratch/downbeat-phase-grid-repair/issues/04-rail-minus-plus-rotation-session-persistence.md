# 04: −/+ rail rotation and Downbeat Phase persistence in the Session

**What to build:** The user hears the deeper tone on the wrong beat and hunts the right one: a −/+ button pair in the Click Track lane of the Mix-tab rail rotates the **Downbeat Phase** exactly one beat per press (wrapping across the Meter's bounds) — the accents move, every click stays where it landed. The effective phase persists in the **Session** beside the Click Track state so a recovered Session resumes with the user's hunt intact, and the Session's validation gate rejects a corrupt persisted phase. The confidence label stays strictly about the tempo reading; the −/+ affordance itself is what signals the Downbeat is adjustable.

**Blocked by:** 01 (OpenDesign run — the −/+ control's look, or its recorded agent-authored fallback), 02 (Automatic Downbeat Phase — the phase value and engine synthesis rule must exist to rotate).

**Status:** ready-for-agent

- [ ] Rail component seam pinned: a −/+ press rotates the deeper-tone accent exactly one beat up/down; presses wrap around the Meter bounds (phase stays in 0..Meter−1); the full click onset set never moves.
- [ ] Changing the Meter keeps the stored phase valid and re-derives accents for the new grouping — a mid-hunt phase is not reset by a Meter change.
- [ ] The control exists only in the unlocked Mix tab's Click Track lane; a disabled lane shows no rotation buttons (existing disabled-lane precedent).
- [ ] Honesty: no new certainty claim anywhere on the phase axis; the existing confidence micro-line and its ≥0.99 "solid reading" clause stay strictly tempo-only (regex-level assertions must stay untouched).
- [ ] Session store seam pinned: Downbeat Phase round-trips as a sibling of the Click Track state; an out-of-range persisted phase is rejected by the same style of validation gate that guards the Click Track state.
- [ ] Session Recovery pair pinned: a resumed Session replays the effective phase — no re-scoring happens on resume (there are no samples on hand), and the rail readout resumes consistent with the persisted phase.
- [ ] Look ported from ticket 01's artifact (or its recorded agent-authored fallback), cited in the commit per the ADR 0007 flow.
- [ ] Full suite + typecheck + glossary green on the commit.

## Comments

- Rotation is relative to the _current_ grid; a −/+ press never relocates beat positions — only which index counts as the Downbeat.
- No absolute phase setter (spinner/"set to beat n") — rotation-only is the settled affordance from the grilling session.
- `Locked Pulse` deliberately absent from the glossary; keep vocabulary exactly `Downbeat` / `Downbeat Phase`.
