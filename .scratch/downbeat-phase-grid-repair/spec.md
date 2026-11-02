# Spec: Downbeat Phase & Beat Grid Repair

Status: ready-for-agent

## Problem Statement

After the Tempo Detector and Click Track shipped, the Click Track is "wonky" on real songs. Two distinct symptoms: the deeper downbeat tone lands on the wrong beat (e.g. the second beat of the bar is accented because the song's downbeat was heard as beat one), and the clicks audibly slide mid-song — the raw tracker's beat positions slip in quiet passages and double up in loud ones, so the click drifts off the drums. Users have no way to fix either: no way to move which beat is accented, and no repair of the beat positions themselves.

## Solution

Two defaults baked into the Tempo Detector, each user-correctable and never presented as proven (per ADR 0011):

1. An automatic **Downbeat Phase** reading per Beat Grid — the worker scores candidate phases 0..Meter−1 by low-energy prominence around the beats that land on them and emits its best pick — plus a −/+ one-beat rotation control in the Click Track lane of the Stem Player for the user's override. The **Downbeat** identity is a listening decision (chord change, bass drop, vocal landing), not a property of beat positions, so it is suggested, asserted, and rotatable.
2. A hybrid snap repair of the Beat Grid inside the worker: each tracked beat is trusted within a tolerance, slips are repaired against the uniform pulse implied by the chosen BPM, double-gaps are filled, and passages of genuine fluctuation keep their human-feel position. A fully locked uniform grid is rejected — it flattens real phrasing and contradicts what the Beat Grid glossary entry defines it _not_ to be.

One **Downbeat Phase** value governs everywhere: playback, rail readout, Session persistence, and the Click Track file inside the Export Bundle. The repaired grid is what every consumer sees.

## User Stories

1. As a user playing the Click Track over a Source Mix, I want the deeper downbeat tone to land where the music's downbeat actually is, so that bar structure sounds right rather than a beat-late waltz feel.
2. As a user, I want the app to pick the Downbeat automatically on first listen, so that I usually hear it right with zero configuration.
3. As a user whose automatic reading is wrong, I want a −/+ button pair on the Click Track lane that rotates the accent one beat at a time, so that I can hunt the downbeat by ear without touching click positions.
4. As a user rotating the Downbeat, I want only the accent pattern to move while every click stays exactly where it landed, so that fixing phase never re-aligns the grid to my taste instead of to the music.
5. As a user, I want the Downbeat Phase to be one value per Beat Grid in the range 0..Meter−1, so that rotation wraps cleanly around any Meter (2/4, 3/4, 4/4, 6/8).
6. As a user re-locking my Tempo Detector choice to a different BPM candidate, I want the automatic Downbeat re-read against the new Beat Grid rather than carrying my old nudge, so that a rotation tuned against the old halved/doubled positions can't corrupt the new grid.
7. As a returning user with a resumed Session, I want the effective Downbeat Phase persisted beside the Click Track state, so that clicks resume exactly as I left them — the resumed Session has no samples to re-score from, and none is silently re-guessed.
8. As a user, I want the Session validation gate to reject a corrupt persisted phase, same as the Click Track state's gate, so a malformed Session never invents a phase.
9. As a user hearing the Click Track mid-song, I want the clicks to stay locked to the drums instead of sliding through quiet bridges and doubling in loud choruses, so the tracker's slippage is repaired for playback.
10. As a drummer on human-phrased material, I want passages of genuine fluctuation to keep their real positions, so the repaired Beat Grid still breathes where the music actually breathes.
11. As a user, I want each raw tracked beat trusted within a tolerance before any repair touches it, so repair never relocates a beat the tracker clearly heard.
12. As a user, I want double-gaps in the raw positions filled with pulses of the chosen tempo's uniform beat, so the click never silently loses beats in a loud passage.
13. As a developer, I want the snap tolerance derived from verification runs of the real Source Mix against the librosa ground-truth anchor and recorded in the ADR once the runs fix it — not a blind number.
14. As a user, I want the repaired grid to be the single grid every consumer sees — playback, rail readout, Session persistence, export bytes, and test assertions alike — so the raw tracker output is never partially trusted downstream.
15. As a user, I want the automatic Downbeat Phase emitted by the Tempo Detector worker inside its completion message, so the phase reading rides the same off-main-thread heavy pass and the UI never stutters because of it.
16. As a user on a low-end Model Profile, I want phase scoring and grid repair to run in the Web Worker like the rest of the analysis, so the Separate tab's progress and UI stay smooth.
17. As a user exporting to a DAW, I want the Click Track file inside the Export Bundle to obey the same Downbeat Phase as live playback and the rail, so the file's deeper tones match what I heard.
18. As a user, I want the phase-parity contract asserted at the Export Bundle's bundler-args seam, so no export path can silently drop or default the phase (CODING_STANDARDS rule 7).
19. As a karaoke/Custom Mixdown user, I want the Downbeat Phase to change nothing about mixdowns — no click ever summed into any preset — so backing tracks stay clean exactly as before.
20. As a user, I want the confidence label to remain strictly about the tempo reading, and the −/+ affordance itself to be what signals that the Downbeat is adjustable, so the phase axis adds no new certainty claim anywhere ("never presented as proven").
21. As a user of a shaky reading, I want the same honesty bar already established — no claim of a solid reading below the established threshold — and the Downbeat Phase inherits no stronger claim, per ADR 0010's ranking-over-certainty policy extended to the phase axis.
22. As a user changing the Meter, I want the Downbeat Phase to stay valid and accents re-derived for the new grouping, so switching 4/4 to 6/8 doesn't reset my hunt.
23. As a developer and a user, I want the Click Track to stay domain-separate from the four Stems identities in every contract — Session, Export Bundle, mixdown presets — so phase state never leaks into anything resembling a Stem.
24. As a user, I want the −/+ control to live only inside the unlocked Mix tab's Click Track lane, consistent with the Tab Shell's rules, so it surfaces exactly when usable.
25. As a user, I want the new −/+ rail control to look designed, not improvised: the look must come from an OpenDesign run recorded on the ticket before porting to React (ADR 0007), with the documented dead-MCP fallback recorded as agent-authored if the run cannot be made.
26. As a maintainer, I want `Downbeat` and `Downbeat Phase` pinned in the glossary so the vocabulary and the code's variable names agree, policed by `check:glossary`.
27. As a future agent, I want the whole decision recorded as ADR 0011 cross-linked from ADR 0010, including the tolerance-to-be-recorded clause, so the "not a blind number" policy is auditable.
28. As a user of the reference track, I want verification against the librosa anchor (107.7 BPM / 503 beats on `audioslave_stone.mp3` via `scripts/check_bpm.py`) to confirm the repaired grid's intervals and the auto-phase pick on real audio, so the fix earns trust end-to-end.

## Implementation Decisions

- **No new dependencies.** The existing `@audio/beat` tracker pipeline already in ADR 0010 supplies the raw grid; repair and phase scoring are app code on top of it.
- **Tempo Detector worker output shape widens**: its completion message gains a Downbeat Phase value alongside the ranked candidates and Beat Grid, and the Beat Grid it carries is the _repaired_ grid — the raw tracker output never crosses the worker boundary.
- **Automatic Downbeat Phase algorithm (worker, per ADR 0011)**: for each candidate phase 0..Meter−1, score low-energy prominence around the beats that land on that phase of the bar (bass-drop / chord-change proxy over the analyzed channel); emit the best-scoring phase. Ties broken toward the earlier phase. Never presented as proven.
- **Hybrid snap repair (worker, per ADR 0011)**: against the uniform pulse implied by the chosen BPM — each raw tracked beat kept if within snap tolerance; slips relocated to the pulse; consecutive double-gaps (a missed beat) filled with the pulse position; runs of beats that consistently fluctuate together are kept as human-feel. The snap tolerance constant is derived from the verification seam's runs and recorded in ADR 0011 when fixed — implementation tickets carry the derivation step, not a guessed number.
- **Stem Player engine Click Track state gains the phase**: the synthesized Click Track channels place the deeper tone where `(beat index − phase) mod meter === 0` instead of the hard-wired index-0 rule. The Meter's accent pattern definition is untouched — only which beat is the Downbeat moves.
- **Session persistence**: Downbeat Phase is a sibling field beside the Click Track state, covered by the same style of validation gate; a resumed Session replays the effective phase and cannot re-score (no samples on hand).
- **Re-lock semantics**: re-locking to a different BPM candidate re-runs the automatic Downbeat reading against the new grid and discards any previous manual offset — the old nudge is meaningless against halved/doubled positions (ADR 0011).
- **Rail UI**: a −/+ button pair in the Click Track lane of the Stem Player rotates the phase one beat at a time, relative to the _current_ grid. Accents rotate; click positions do not move. No absolute phase setter (a spinner) — rotation-only is the settled affordance.
- **Export parity contract**: one Downbeat Phase governs live playback, rail readout, and the Click Track file in the Export Bundle; the parity is asserted at the bundler-args seam per CODING_STANDARDS rule 7 (spy the phase through the bundle call).
- **Honesty surface (ADR 0010 extended)**: no new claim anywhere. The confidence label stays strictly about the tempo reading; the −/+ affordance itself signals adjustability. The ≥0.99 "solid reading" clause from ADR 0010 is unchanged and phase adds no analogue.
- **Paper trail lands with the code**: the already-drafted glossary entries (`Downbeat`, `Downbeat Phase`) and ADR 0011 (with its ADR 0010 cross-link) are uncommitted on disk and fold into this feature's first commits.
- **OpenDesign for the rail control (ADR 0007)**: the −/+ pair's look must come from a fresh OpenDesign run recorded on its ticket; the repo's documented dead-MCP recovery applies — reconnect recipe, one retry, then agent-authored fallback recorded on the ticket.
- **Vocabulary**: `Downbeat`, `Downbeat Phase`, `Beat Grid`, `Click Track`, `Meter`, `Tempo Detector`, `Session`, `Export Bundle` per `GLOSSARY.md`. `Locked Pulse` deliberately omitted from the glossary.

## Testing Decisions

- **Only external behavior is tested**: decoded audio samples in → grid + phase out of the worker; player settings in → synthesized Click Track onsets out; Session in → Session round-trip out; bundler call arguments observed at the seam. No assertions on `@audio/beat` internals.
- **Six seams, zero new** (reuse-first, all highest-possible):
  1. _Worker + relay seam_ (existing beat-detection worker test, mirrored by its client test): completion message now carries Downbeat Phase and the repaired grid; relay passes both through; worker-fallback path in headless environments keeps the widened shape.
  2. _Stem Player engine seam_ (existing engine test): `synthesizeClickTrackChannel` honors the phase — deeper-tone onsets rotate by phase while all onsets stay put; decoded via the shared WAV→onsets helper already used at this seam.
  3. _Rail component seam_ (existing Mix-tab component test): −/+ press rotates accents one beat up/down, wraps across Meter bounds, and does not move click positions; disabled lane shows no rail control per existing precedent.
  4. _Session store seam_ (existing store test + Session Recovery pair): phase round-trips beside Click Track state; invalid persisted phase rejected by the validation gate; resume replays without re-scoring.
  5. _App bundler-args seam_ (existing App test's spy pattern): spy-args prove the same Downbeat Phase reaches the Click Track file of the Export Bundle as playback and rail state (phase-parity assertion per rule 7).
  6. _Real-audio verification seam_ (existing real-mix test at the `scripts/check_bpm.py` anchor): on `audioslave_stone.mp3`, repaired grid intervals match the librosa ground truth within the derived tolerance, double-gaps and slips of the raw pass are shown repaired, and the auto-phase pick is exercised against the anchor's beat set. **The tolerance is fixed and recorded in ADR 0011 by these runs** — the test asserts the recorded value, so it lands only after derivation.
- **Good-test bar**: octave-tolerant windows for anything tempo-derived (the engine's own benchmark is Acc1 87% / MAE 8.7 BPM with inherent octave ambiguity); onsets compared by decoded seconds through the shared helper, not by engine internals.
- **Prior art**: every seam above is an already-passing test of the click-track-tempo feature (worker relay, engine synthesis, rail component, store round-trip, bundler spy, anchor assertions) — this feature extends assertions in place, following the established vitest + fake-indexeddb setup with no new harness.
- **Every commit Husky-green**: typecheck + `check:glossary` + full suite; heavy verification runs stay off the critical path. No subagents (repo rule) — reviews and test passes run inline.

## Out of Scope

- ML trackers (TempoCNN, DeepRhythm) or any additional model downloads and Model Profiles.
- Re-detection on the Drums Stem after separation (deliberately rejected in ADR 0010).
- Absolute phase setting (a spinner or "set downbeat to beat 3" input) — rotation-only −/+.
- Beat subdivisions (half/eighth clicks), count-in patterns, and per-instrument clicks.
- Beat marks projected onto the Master Waveform.
- A fully locked uniform grid — rejected outright: it contradicts the Beat Grid's glossary definition and flattens genuine fluctuation (ADR 0011).
- Time-varying tempo segmentation UI; the repaired grid covers rubato at one global tempo.
- Changing the Meter's accent pattern itself (deeper-tone-on-downbeat stays as defined).
- The four Stems identities, mixdown presets, Transport, Tab Shell, and Custom Mixdown behavior — untouched by this feature.
- Real-time microphone/stream analysis and any server/API round-trips (ADR 0001).
- Independent Click Track speed controls (unchanged from ADR 0010: the lane is locked to the Stems).

## Further Notes

- Decisions recorded: `docs/adr/0011-downbeat-reading-and-beat-grid-repair.md` (drafted, uncommitted — folds into the feature's first commits), cross-linked from `docs/adr/0010-client-side-tempo-detection-and-click-track.md`.
- `Downbeat` and `Downbeat Phase` glossary entries are already drafted in `GLOSSARY.md` (uncommitted) and will police this feature's variable naming via `check:glossary`.
- Ground truth on this machine: librosa 1.0.0 via `scripts/check_bpm.py` reports 107.7 BPM / 503 beats (full mix) / 513 beats (low-band proxy) on `audioslave_stone.mp3` (294.1 s). Raw-tracker slips the repair must tame live there; the repair's tolerance constant is pinned by those runs.
- Base branch: the click-track-tempo feature branch (`feature/click-track-tempo`, HEAD `e9350bd`) was never merged to `main`; this feature builds directly on its code, so the first step is merging/landing that branch, then branching `feature/downbeat-phase-and-grid-repair` from it.
- OpenDesign MCP is currently recorded as dead (cancelled run + unknown-tool error); the recovery procedure in the agents docs gives the rail-control run one retry window before the agent-authored fallback, which must be recorded on its ticket (ADR 0007 flow).
- User symptom report maps cleanly: "downbeat on wrong beat" = phase/index-0 error; "clicks drift mid-song" = raw tracker slippage — the two-fix split of ADR 0011 matches the two symptoms one-for-one.
