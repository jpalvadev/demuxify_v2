# Spec: Engine Command Surface — The Player Engine Speaks Commands and Reports One Mixer State

Status: resolved-in-full (2026-11-06)

Recorded on the tracker 2026-11-06. This is the architecture-review increment (candidate 6 of the 2026-11-05 architecture report, the one the report marked _Speculative_ and deliberately sequenced after candidate 1): a deepening of the **Player Engine**'s interface, not a feature — the shipped Mix **Tab** behavior is the promise, byte-for-byte, exactly as the `transport-snapshot` increment promised it. Candidate 1 landed first precisely so this shrink would have a seam to shrink against (ADR-0013 amendment, 2026-11-06), and the report's own note is honored: the **Transport** snapshot is the seam this interface shrinks against. An **ADR-0016** is authored at porting start, with **ADR-0012** and **ADR-0013** amendments. Glossary terms used throughout: **Player Engine**, **Mixer State**, **Stem Player**, **Transport**, **Playhead**, **Peak Pips**, **Master Waveform**, **Stem Strip**, **Stems**, **Source Mix**, **Session**, **Tab Shell**, **Tab**, **Rail**, **Click Track**, **Beat Grid**, **Time-Stretch**, **Pitch-Shift**, **Formant Preservation**, **Hand Calibration**, **Tempo Detector**.

Fact recorded against the report: the report's headline counts "35 public methods". The shipped surface is **47** (41 inside the report's cited public window, 6 below it). The shrink is deeper than the report advertised.

## Problem Statement

Everything a screen shows about the **Stem Player** is read out of the **Player Engine** one control at a time. The engine's implementation is genuinely deep — the worklet, WSOLA, fallback sources, Click Track synthesis, level sampling — but its interface is a wall of thin pairs: `getStemVolume`/`setStemVolume`, `getTempo`/`setTempo`, `getPitch`/`setPitch`, mute and solo getters with setters and toggles on top of each, four separate subscription channels, and a row of getters that hand out live WebAudio nodes. Touching playback means learning the whole method map, and the only way to know what the player is showing is to ask for each fact separately, 47 ways.

Concretely, the **Stem Player** component re-mirrors **nine** engine facts into its own React state (play state, position, duration, per-Stem mixer, Master volume, tempo, pitch, Formant Preservation, Click Track lane) and, after every command, asks the engine again for the facts it just changed — "set, then re-get, then re-emit" triplets. The result:

1. **The interface is as wide as the implementation.** A caller cannot see which facts are the product and which are the plumbing: getting a gain node out of the player is one getter away from getting its volume, and 51 of the 52 references to the node getters are tests.
2. **The same facts are stored twice, a frame apart.** Nine mirrors inside the player, re-filled from the engine after every press, are the same shape of bug the 2026-11-06 ADR-0013 amendment diagnosed on the shell side — the shell's mirrors are now banned, and the player's own mirrors are what is left.
3. **Domain rules live in the UI.** The quantization of tempo (0.5 steps) and **Pitch-Shift** (whole semitones) and the range clamps are enforced in the component; the engine accepts anything its setters are handed.
4. **Dead surface ships.** Two methods have no consumer anywhere in the repo, and the getter that hands out per-Stem buffers exists only to carry audio data that already entered the player as a prop.

## Solution

The **Player Engine** keeps its depth and grows a small mouth. Its interface becomes **commands in, one Mixer State out**:

- **Read side:** one snapshot — `{ playing, playheadSec, duration, masterVolume, stems, clickTrack, timeStretch, levels, stretchMode }` — read through one subscription, published only when a fact actually changes.
- **Command side:** ten verbs — `play · pause · seek · applyMixer · applyTimeStretch · applyClickTrack · setBeatGrid · snapshot · subscribe · dispose` — plus one async verb for readiness.

Toggle verbs leave the interface: the UI computes the next press from the snapshot, and the engine enforces ADR-0012's solo/mute exclusivity where the gain matrix already lives. Quantization and clamps move into the commands, so the applied value the snapshot reports is the engine's honest answer, not the UI's arithmetic. The audio-graph getters collapse into **one named probe** that exists for the gain observicals, and the buffer getter dies — Stem Strip waveforms are painted from data the player already has.

The **Stem Player** stops mirroring: it reads the snapshot the way the shell reads the **Transport** snapshot, and its outbound channels keep their exact shapes, fed by snapshot transitions. Nothing the user sees, hears, saves, or a test asserts through the Mix Tab changes — this is a collapse of the interface, and the four subscription channels become one.

## User Stories

1. As a Mix Tab user, I want every fact on screen — the four **Stem Strips**, the **Click Track** lane, the **Time-Stretch** and **Pitch-Shift** controls, the **Transport** faces, the **Peak Pips** — to come from one Mixer State read at one instant, so no two surfaces of the player can ever disagree.
2. As a Mix Tab user, I want pressing Solo on a muted **Stem** to clear its mute and play it alone, and pressing Mute on a soloed **Stem** to drop the solo, so that the ADR-0012 exclusivity I already have keeps working exactly as it does today.
3. As a Mix Tab user, I want the Tempo slider to keep landing only on 0.5 steps and the Pitch slider only on whole semitones, so that the quantized feel I have today is unchanged — now guaranteed by the engine rather than by the slider's arithmetic.
4. As a Mix Tab user, I want "Reset Pitch & Tempo" to land on an honest 1.00x and 0 st with Formant Preservation left exactly where I set it, so the reset button keeps its meaning.
5. As a Mix Tab user, I want the **Click Track** switch and fader to keep behaving as they do today — inert with no **Beat Grid**, uniform taps with the lane, volume 0 as its own silence — so the lane's contract survives the interface change.
6. As a mixer re-locking to another BPM candidate, I want the **Beat Grid** swap to keep replacing the clicks' positions in place, mixer settings and Playhead untouched, so ticket 06's re-lock contract survives.
7. As a Mix Tab user, I want the **Stem Strip** waveforms to look exactly as they do now, per Stem, so deepening the interface paints nothing new and removes nothing.
8. As a keyboard user, I want the Space toggle to keep driving the same transport as the footer disc, so the fallback channel is untouched.
9. As a screen-reader user, I want every accessible name, `aria-pressed`, `aria-checked`, `aria-valuenow` and every pinned `data-testid` of the Mix Tab to keep resolving, so the deepening is invisible from outside.
10. As a phone user, I want zero class-token change at 390×844 and 1440×900, so the stitch-skin fidelity loop sees this increment as a no-op on the view target.
11. As a returning user, I want a restored **Session** to land the same mixer values, Playhead, lane settings and Master volume as it does today, seeded through the same path, so recovery is byte-identical.
12. As a returning user, I want the **Session** auto-save cadence untouched — the mixer-and-Session bridge keeps its meaning, stays the single writer of mixer state, and never fires on a position tick — so persistence never churns.
13. As a developer, I want ten verbs and one snapshot as the whole interface of the playback core, so touching playback stops requiring a 47-method map.
14. As a developer, I want the engine's readiness fact to be one awaitable verb, so the tests and any future surface stop needing the worklet's internals.
15. As a developer, I want the engine to report its Time-Stretch route as one fact (WebAssembly, WSOLA, basic), so "is the worklet in use" and "which stretch mode" stop being two getters.
16. As a developer, I want no getter handing out a live WebAudio node on the interface, so the audio graph stops being part of the product surface — the one probe that exists for the observicals is the named exception.
17. As a developer, I want the mixer, stretch and lane commands to take a partial and apply it, so a control press crosses as one command with one echo, not as a setter plus a re-get.
18. As a developer, I want no mirror state of engine facts inside the player, so the pattern the ADR-0013 amendment already bans in shell code cannot re-form one layer down.
19. As a developer, I want no ref mutated during render, and no subscription channel added, so the deepening removes wiring and adds none.
20. As a tester, I want the engine's behavior suite to cross exactly one interface — commands in, Mixer State out — so engine behavior is testable without walking 42 method names.
21. As a tester, I want the solo/mute press-sequence observicals to keep measuring gain on live gain nodes, so the ADR-0012 guardrail keeps grading the engine on its output and not on its own report.
22. As a tester, I want the **Stem Player** component seam, the **Time-Stretch** seam, the whole-App seam, the **Transport** bridge seam, the **Stem Strip**, **Master Waveform** and **Session** store seams green with zero retargets, so their green is the proof no meaning crossed the seam.
23. As a tester, I want no new seam and no new mock dialect, so the repo keeps the fewest seams it can — the engine's two injected adapters (the shared mock AudioContext factory, the injected stretch adapter) are enough.
24. As a maintainer, I want every existing pinned `data-testid` to keep resolving with zero new ids, and every retired affordance to stay banned.
25. As a maintainer, I want the zero-importer backwards-compatibility re-export of the **Stem Strip** deleted, with its glossary-gate exemption deleted in the same commit, so the ban on "Track" for Stems stops carrying a live exception.
26. As a maintainer, I want dead surface deleted, not left public, so nothing in the repo ships an API with no consumer.
27. As a future reader, I want an ADR explaining why the playback core reports one Mixer State and why there is no `setStemVolume`, so nobody reintroduces the getter/setter pairs.
28. As a future reader, I want ADR-0012's exclusivity record to say where the enforcement now lives, and to name the retired method names on a history line, so the docs stay truthful to the shipped code.
29. As a future reader, I want ADR-0013 to record that the player's channels survived untouched and its mirrors died inside the player, so the 2026-11-06 ban on mirrors reads as continuous.
30. As a stitch-skin author, I want this increment to touch no class token, palette token, label, copy string, native-slider treatment, or accessible name, so the screenshot loop never conflicts with engine wiring.
31. As an agent working the next architecture candidate, I want the four subscription channels' meanings (position, state, levels, time-stretch) expressed as fields of one snapshot, so the remaining deepening candidates can be planned against a narrow surface.

## Implementation Decisions

- **The Player Engine stays one module and one class.** No wrapper, no sidecar module: the snapshot type, the publish rules, the commands, `setBeatGrid`, the readiness verb, the probe and disposal are that class's whole public surface, and its internals (the gain matrix, click synthesis, WSOLA/fallback sources, level sampling, worklet handoff) stay private and untouched. Edits in a 1400-line file are anchored with the outline tool.
- **The snapshot shape** (decision-bearing; sub-objects are the engine's existing domain types, unchanged):

  ```ts
  interface StemPlayerSnapshot {
    playing: boolean;
    playheadSec: number; // canonical Source Mix seconds (the Playhead)
    duration: number;
    masterVolume: number; // 0..1, the Master bus
    stems: StemMixerStates; // per-Stem { volume, muted, solo }
    clickTrack: ClickTrackMixerState; // { enabled, volume } — no mute, no solo
    timeStretch: TimeStretchState; // { tempo, pitch, formantPreservation? }
    levels: StereoPeakLevels; // post-fader L/R, engine-coalesced
    stretchMode: "signalsmith" | "wsola" | "basic";
  }
  ```

- **Publish rules** (mirroring the rules the 2026-11-06 Transport bridge runs): publish only on real change — an equal snapshot never publishes and never mints a new object; sub-objects are cloned at publish so a reader can never mutate engine state through the snapshot; the snapshot is read with `useSyncExternalStore` semantics. The Playhead's per-frame cadence rides this one snapshot (the player already re-renders per frame today, so the cadence is not new), and the mixer-and-Session bridge is driven only by mixer-fact transitions, never by position or levels transitions (ADR-0013's cadence rule, persistence's single writer untouched).
- **The command side is ten verbs plus one async verb:** `play`, `pause`, `seek`, `applyMixer(partial)`, `applyTimeStretch(partial)`, `applyClickTrack(partial)`, `setBeatGrid(grid)`, `snapshot()`, `subscribe(listener)`, `dispose()`, and `waitForReady()`. Master volume rides inside `applyMixer`, so the Transport bridge's existing `setMasterVolume` verb maps onto that command with its shell-side shape unchanged. `setBeatGrid` is its own verb: the **Beat Grid** is shared stage machinery the lane follows, not Mixer State, and the snapshot carries no grid field.
- **No toggle verbs.** The UI derives the next press from the snapshot and sends the state it wants; the engine resolves ADR-0012's per-Stem exclusivity inside `applyMixer`, where the gain matrix already enforces it. The enforcement code keeps running under the ADR-0012 method names as **private** methods, so the ADR's citation of them stays true in shipped code; the ADR amendment records that the public pair verbs are retired.
- **Quantization and clamps move from the UI into the commands.** Tempo quantizes to 0.5 steps, Pitch-Shift to whole semitones, ranges clamp, and the snapshot reports the applied value. The sliders keep their step attributes and their visible behavior byte-identically; they simply stop being the rule's home.
- **`applyTimeStretch` absorbs the reset.** The reset command is `applyTimeStretch` at 1.00x and 0 st — the honest reset the button already performs. Formant Preservation is untouched by the reset, exactly as today.
- **The audio-graph getters collapse into one named probe.** One accessor hands out the node bundle (master and per-Stem gains, click gain, analysers/taps, active sources, stretch adapter) as the observicals' home — the ADR-0012 press-sequence gain assertions, the fallback-source assertions, and the signalsmith delegation assertions all ride it, at the engine seam _and_ at the component seam, which asserts live gain values today. Every other node getter, the per-Stem buffer getter, the adapter getter, the two stretch getters, and the grid/state/time-stretch/levels getters leave the interface.
- **`getStemBuffer` dies; Stem Strip waveforms are prop-derived.** The buffers it handed out are built from data the **Stem Player** already received as a prop, and the peaks reader accepts a duck-typed buffer-like shape and a ready `peaks` prop. So the player derives each Strip's peaks once per Stem from its own prop, keeping the waveforms, peak values, and the pinned Strip behavior byte-identical, and keeping audio payloads out of Mixer State.
- **The player's nine mirror states die.** Play state, position, duration, per-Stem mixer, Master volume, tempo, pitch, Formant Preservation, and lane state are read from the snapshot, as are the post-command re-reads; the "set, re-get, re-emit" triplets collapse to one command plus one echo. Derived UI facts (`hasAnySolo`, `isSilenced`) stay UI-side arithmetic on the snapshot.
- **Channel emission rules.** The outbound channels keep byte-identical names, payloads, and meanings: the mount-time initial emits survive (a pinned test demands the lane's first report), every real transition emits exactly once, `onMixerChange` keeps its `{ stems, masterVolume, currentTime }` shape, the export-panel bridge keeps its `{ mixerStates, masterVolume, timeStretch }` shape, and the position/play-state/levels channels keep their cadence. The grid-swap echo that restates an unchanged lane state disappears (publish-on-change has no echo to send); if a pinned test depends on a no-change echo, the echo stays and is named on the ticket as a deliberate preservation.
- **Untouched by contract:** the **Stem Player**'s props and its channels, the Transport bridge module and its live/scripted adapters, the whole shell wiring, the construction options (`StemPlayerEngineOptions` and its init sanitize), the restored-Session path (props → constructor, plus the bridge's existing seed rule — no new seeding verb), the gain matrix math, WSOLA and WebAssembly stretch math, click synthesis, level sampling and coalescing, the **Master Waveform** ruler face and its repaint ceiling, and the **Tempo Detector**/**Hand Calibration**/**Beat Grid** machinery.
- **Dead and zero-consumer surface is deleted, not left public** — including the two methods with no consumer anywhere, and the zero-importer **Stem Strip** re-export file, whose glossary-gate exemption entry is deleted in the same commit so the ban stops carrying a live exception.
- **Records.** **ADR-0016** ("the Player Engine speaks commands and reports one Mixer State") authored at porting start with the considered options; **ADR-0012** amendment (enforcement moves into the mixer command, public pair verbs retired, enforcement names kept private); **ADR-0013** amendment (channels byte-unchanged, player mirrors die inside the player, zero new channels). **GLOSSARY.md** already carries the two new terms **Player Engine** and **Mixer State** (written during grilling, 2026-11-06). No view is designed, so the OpenDesign MCP is not called; each ticket carries the record "no new look rendered, skin byte-untouched".
- **Tickets:** five vertical slices, numbered 01–05, each shipping with a consumer — 01 the snapshot + subscribe + mixer verbs, with the four **Stem Strips** as first consumer and the mixer mirrors dead; 02 Time-Stretch and Pitch-Shift (quantization moves in, the reset command, the strip's stretch faces); 03 the Click Track lane plus `setBeatGrid` (re-lock contract intact); 04 the getter purge and probe, the buffer getter's death, dead-surface deletion, the re-export file's deletion, and the engine suite fully retargeted; 05 the verification sweep, fidelity loop, and the ADR record.

## Testing Decisions

- **What makes a good test here:** external behavior only. Commands crossed in, Mixer State observed out, and rendered DOM (accessible names, `aria-pressed`/`aria-checked`/`aria-valuenow`, native slider values, waveform paint) at the consumer seams. Never engine internals, never private methods, never the graph.
- **Zero new seams.** The engine seam is the surface under test and it already has two adapters — the injected shared mock AudioContext factory and the injected stretch adapter — so no new seam and no new mock dialect is minted, per the candidate-1 lesson (a seam needs two adapters; this one has two). The Transport bridge seam, with its scripted adapter, stays exactly where candidate 1 put it and is not re-cut.
- **Retarget roster (they drive the engine directly):** the engine behavior suite (42 tests → commands in / Mixer State out), the signalsmith delegation suite (3), and the mobile end-to-end suite (7). The ADR-0012 press-sequence observicals keep asserting gain outcomes on **live gain nodes** through the probe — the same numbers, byte-identical — because the guardrail must not grade the module on its own report.
- **Parity guards, green with zero retargets:** the **Stem Player** component seam (21), the **Time-Stretch** component seam (9), the whole-App seam (60), the Transport bridge seam (11), plus the **Stem Strip**, **Master Waveform**, and Session store seams. Their green is the proof the increment moved no meaning across the seam; a suite that goes red for interface reasons is retargeted, a suite that goes red for behavior reasons means the increment broke the promise.
- **Prior art to imitate:** the scripted Transport adapter's discipline (commands in, snapshot out, zero audio machinery), the shared mock AudioContext factory's discipline of asserting observable gain outcomes, the ADR-0012 observicals in the engine suite, and the Session store round-trip seams.
- **Gates:** the full pre-commit chain — `check:glossary`, `check:doc-anchors` (retired method names ride the historical-skip rule; the private enforcement names keep ADR-0012 reading clean), `check:testids` (all presence pins resolve, zero new ids), `check:retired-affordances`, `check:test-fixtures`, `check:dist-fresh`, typecheck, `test:report`. The stitch-skin fidelity loop re-runs at 1440×900 and 390×844 in the closing ticket with **zero class-token diff**.
- **Deliberately not required:** the beat-grid anchor and BPM ground-truth replays. The snap tolerance and every ADR-0011 recorded number are untouched; ticket 03 is a plumbing move, and its green parity guards prove it.

## Out of Scope

- The **Stem Player**'s props, its outbound channels, and the Transport bridge: shapes, names, cadences, live and scripted adapters byte-unchanged (ADR-0013). This spec deepens the interface below the player.
- The remaining architecture-report candidates: the Tempo Detector flow module, the Session module, the Export render pipeline, and the shared worker bridge. Each is its own future grilling session and its own increment.
- Audio behavior of every kind: the master bus and gain matrix math, WSOLA and WebAssembly stretch math, Click Track synthesis, level sampling and coalescing, the position loop.
- Visual skin: every class token, palette token, label, copy string, layout, native-slider treatment, and mobile rail layout (ADR-0014 contract).
- Session persistence mechanics, the IndexedDB shape, the auto-saver debounce, and the mixer-and-Session bridge's write side (single-writer and cadence rules preserved verbatim).
- The stretch adapter's own protocol (the multi-track stretch node's get/set shape) and the worker seams: the engine delegates to the adapter; the adapter's interface is a separate seam and stays as recorded.
- The **Master Waveform**'s ruler face, its repaint ceiling, the **Peak Pips**' tint rules, the footer disc's dispatch logic, the keyboard Space listener, **Hand Calibration**, the **Tempo Detector**, **Beat Grid** repair machinery, and every export surface.

## Further Notes

- **Report facts, measured:** the public surface is 47 methods, not 35 (41 in the report's cited window, 6 below). Two methods have zero consumers repo-wide; the per-node getters carry 51 test references against 1 production reference; the buffer getter's only production consumer is the player that received that data as a prop. The nine player mirrors and the post-command re-reads were counted in the shipped component.
- **Deletion test:** delete the snapshot and its rules reappear as 47 methods, four channels, nine mirrors, and UI-side quantization — the complexity concentrates, so the module earns its keep.
- **Seam count: zero new seams.** Every seam that exists today keeps reading the same facts; one existing seam (the engine) becomes the deepest test surface in the repo. This is the "ideal number is one" answer for this increment.
- **Hot-zone evidence:** the player/engine wiring is where the 2026-11-04 and 2026-11-05 footer and Mix-card surgery repeatedly landed; the 2026-11-06 shell-side mirror ban left the player's mirrors as the last copy of the same pattern.
- **Sequencing:** candidate 1 landed first (branch `transport-snapshot`, tickets 01–05, ADR-0013 amendment) precisely to be the seam this shrink reads against. Candidates 2, 3, 4 and 5 stay in the fog on purpose: 5 (the shared worker bridge) gets cheaper once the engine reports one snapshot, and 2, 3 and 4 each own their own seam.
- **ADR posture:** append-only house format. ADR-0008/0012/0013's live decisions (single toggle, one Playhead channel, per-Stem exclusivity, bridge cadence, single writer) all survive verbatim, which is why this spec contradicts nothing and amends two records.
