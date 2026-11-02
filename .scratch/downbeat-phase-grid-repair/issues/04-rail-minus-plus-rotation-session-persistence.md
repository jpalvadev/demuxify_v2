# 04: −/+ rail rotation and Downbeat Phase persistence in the Session

**What to build:** The user hears the deeper tone on the wrong beat and hunts the right one: a −/+ button pair in the Click Track lane of the Mix-tab rail rotates the **Downbeat Phase** exactly one beat per press (wrapping across the Meter's bounds) — the accents move, every click stays where it landed. The effective phase persists in the **Session** beside the Click Track state so a recovered Session resumes with the user's hunt intact, and the Session's validation gate rejects a corrupt persisted phase. The confidence label stays strictly about the tempo reading; the −/+ affordance itself is what signals the Downbeat is adjustable.

**Blocked by:** 01 (OpenDesign run — the −/+ control's look, or its recorded agent-authored fallback), 02 (Automatic Downbeat Phase — the phase value and engine synthesis rule must exist to rotate).

**Status:** resolved (landed in ONE commit with ticket 05 — the rail press channel and the re-lock re-read share the same beam effect and JSX props, so they are inseparable at the seam; the commit cites both tickets)

- [x] Rail component seam pinned: the rail's −/+ press (testids `click-track-phase-minus`/`click-track-phase-plus`) drives `engine.rotateClickTrackDownbeat(±1)` — exactly one beat per press, wrapping inside 0..Meter−1 (engine unit tests pin wrap + positions-untouched), and the App seam asserts the readout walk Beat 1→2→1 with the onset grid never re-fed.
- [x] Changing the Meter keeps the stored phase valid and re-derives accents for the new grouping — a mid-hunt phase is not reset by a Meter change (App seam: plus at 4/4 then Meter 6/8 → "Beat 2 of 6", tag still cleared).
- [x] The control exists only in the unlocked Mix tab's Click Track lane: the gated-Mix assertion now checks `click-track-phase-plus` is absent alongside the rail.
- [x] Honesty: no new certainty claim on the phase axis — the readout says "Beat k of n" + dim "auto", and the confidence micro-line (≥0.99 "solid reading") is untouched, its regex assertions intact.
- [x] Session store seam pinned: `downbeatPhase` round-trips as a SIBLING of tempo/clickTrack (ticket-02 commit carries the store tests: phase-0-survives, legacy-absent, malformed-gated by the `isValidDownbeatPhase` validation gate).
- [x] Session Recovery pair pinned: the resume merge reads `session.downbeatPhase ?? 0` into the ref, the rail readout resumes "Beat 2 of 6 · auto" for the stored pairing, and no re-scoring runs on resume (no samples on hand).
- [x] Look ported from ticket 01's recorded FALLBACK RECORD (agent-authored; the OpenDesign MCP never revived) — −/+ chips after the Meter selector, "Beat {phase+1} of {n}" readout, "auto" tag cleared on first press — cited in the commit.
- [x] Full suite + typecheck + glossary green on the commit.

## Comments

- Rotation is relative to the _current_ grid; a −/+ press never relocates beat positions — only which index counts as the Downbeat.
- No absolute phase setter (spinner/"set to beat n") — rotation-only is the settled affordance from the grilling session.
- `Locked Pulse` deliberately absent from the glossary; keep vocabulary exactly `Downbeat` / `Downbeat Phase`.
- Deviation from the spec sketch: `onClickTrackPhaseChange` reports the engine's NEW phase (`(phase: number) => void`) instead of a bare zero-arg press signal — the app cannot mirror a wrap that depends on the current Meter's modulus without knowing it, and reporting the value keeps the persisted pairing exactly what is heard.
