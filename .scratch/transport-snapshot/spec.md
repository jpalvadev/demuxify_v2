# Spec: Transport Snapshot — One Deep Transport Module at the Shell Seam

Status: ready-for-agent

Recorded on the tracker 2026-11-06. This is the architecture-review increment (candidate 1 of the 2026-11-05 architecture report): a deepening of the **Transport** wiring, not a feature — the shipped Mix **Tab** behavior is the promise, byte-for-byte. It contradicts no ADR: ADR-0008's single **Play/Pause** toggle and ADR-0013's one Playhead channel, bridge meanings, and mixer-bridge cadence all survive exactly as recorded, moving from App convention into a module's implementation. An ADR-0013 amendment is authored at porting start. Glossary terms used throughout: **Transport**, **Playhead**, **Peak Pips**, **Master Waveform**, **Stem Player**, **Session**, **Tab Shell**, **Tab**, **Rail**, **Stem Strip**, **Source Mix**, **Time-Stretch**.

## Problem Statement

The shell's transport surfaces — the footer **Transport** bar's coral disc, its Master fader and % readout, the **Peak Pips**, the **Master Waveform** spine, and the clock chip — all display facts the engine owns, but every fact is mirrored a second time before it reaches the screen. The **Stem Player** exports five channels (the transport bridge handoff, the Playhead channel, the play-state channel, the levels channel, the mixer bridge); App catches them into three mirror states plus a mutable ref that the player writes into mid-render, and the footer JSX reads the mirrors. The consequences:

1. **Any surface can lag or disagree.** Five renderings of the **Playhead** once disagreed on screen (ADR-0013's symptom); the mirror architecture is why it could. Nothing structurally guarantees the disc, fader, pips, spine, and clock show the same instant of the same value.
2. **The hot zone is expensive.** The footer/transport wiring is the repo's hottest wiring — every stitch-skin fidelity commit re-edits these mirror states, the ref, and the footer JSX, and every fidelity loop re-learns where each fact lives.
3. **The behavior is untestable where it lives.** Transport behavior at the App seam is tested by swapping `window.AudioContext` with hand-built live/meter context classes inside whole-App renders — thousands of tokens of scaffolding to reach facts that should be a plain snapshot.
4. **The rules live in prose, not code.** "The Playhead rides the one position channel", "the mixer bridge never fires per frame", "the disc's mirror never desyncs, end-of-track stops included" are ADR-0013 conventions enforced by reviewer vigilance across five App states and a ref.

## Solution

One deep module — the **Transport bridge** — sits at the shell seam between the **Stem Player** and everything the Tab Shell shows. Its interface is small:

- **Read side:** subscribe to one snapshot — `{ playing, playheadSec, masterVolume, levels }`.
- **Command side:** exactly four verbs — `play()`, `pause()`, `seek(seekSec)`, `setMasterVolume(volume)`.

Two adapters sit at the seam:

- **Live adapter:** wires the **Stem Player**'s existing channels (bridge handoff, Playhead, play-state, levels, mixer bridge) into the snapshot. ADR-0013's cadence rules — position channel feeds Playhead and phase, levels arrive coalesced, mixer bridge feeds master-volume restatements only — move from App convention into this implementation.
- **Scripted adapter:** a test-side double that feeds snapshots and records commands, so the whole transport surface can be driven with no audio machinery at all.

App deletes its mirror states (`footerTransportPlaying`, `footerMasterVolume`, `footerPeakLevels`, `currentTime`) and the mid-render mutable ref. The footer chrome, the spine wiring, and the clock chip read the snapshot through one subscription. The **Stem Player**'s interface — its bridge handoff and its five channels — is untouched (ADR-0013: "the bridge interface itself is untouched"), so no Mix Tab behavior, look, or persistence changes: this is a collapse of the App side of the seam, and one interface becomes the single place the shell's transport truth is read, written, and tested.

## User Stories

1. As a Mix Tab user, I want the disc, the Master fader, the % readout, the Peak Pips, the spine, and the clock chip to all read one shared transport snapshot, so no two surfaces ever show disagreeing transport facts.
2. As a Mix Tab user, I want the coral disc press to start playback and flip its icon to the pause bars — the icon shows the action coming next, per the single-toggle Transport.
3. As a Mix Tab user, I want a press while playing to pause and flip the icon back to the play triangle.
4. As a Mix Tab user, I want an end-of-track stop to flip the disc back to play on its own, so a stopped Session never shows a lying playing icon.
5. As a mixer, I want the footer Master fader to drive the same master bus as everything else and its % readout to reflect every master-volume restatement, whoever fired it — the Mix rail, a restore, the fader itself.
6. As a mixer, I want the Peak Pips to keep rising fast and falling slow with the post-fader Master signal, so the pips remain the honest level display the glossary promises.
7. As a Mix Tab user, I want scrubbing the Master Waveform spine to land the Playhead, the clock chip, and every Stem Strip on that one seeked value.
8. As a keyboard user, I want the Space toggle to keep working exactly as the fallback transport channel, with its text-field guard intact.
9. As a returning user, I want a restored Session to seed the snapshot — my Master volume and Playhead — so the footer never flashes defaults before the player lands.
10. As a user on the Separate Tab with no Stems yet, I want the footer disc and fader to stay inert and sane (no crash, no phantom play state), so the chrome reads idle until a Session exists.
11. As a screen-reader user, I want the disc's `aria-pressed`, the fader's accessible name, and the pips' hidden-from-accessibility treatment to stay exactly as shipped.
12. As a phone user, I want the footer bar geometry, native sliders, and centered knobs untouched, so the stitch-skin fidelity loop sees zero diff from this increment.
13. As a mixer, I want the Session auto-save cadence untouched — the mixer bridge keeps its own meaning and never fires per frame — so persistence never churns.
14. As a developer, I want one subscription delivering the whole transport truth, so wiring any new shell surface to playback is one read, not five channels.
15. As a developer, I want four verbs — play, pause, seek, setMasterVolume — as the only transport commands the shell needs.
16. As a developer, I want no ref mutated during render, so the transport wiring is free of the one React pattern the docs flag.
17. As a developer, I want the cadence and ownership rules (which channel feeds what) concentrated inside one implementation, so App cannot accidentally violate them.
18. As a tester, I want to drive disc, fader, pips, spine wiring, and clock through a scripted adapter, so App-seam tests stop swapping AudioContext classes.
19. As a tester, I want the transport behavior suite to cross exactly one interface: commands in, snapshot out.
20. As a maintainer, I want every existing pinned `data-testid` on the footer chrome to keep resolving after the rewiring (`check:testids` green), with retired affordances staying banned.
21. As a maintainer, I want the Stem Player and engine test suites to stay green untouched as parity guards — their channels and their 42 engine tests describe the shipped truth.
22. As a future reader, I want an ADR-0013 amendment recording the snapshot module and why the shell reads a module, not App state, so nobody reintroduces mirror states.
23. As a stitch-skin author, I want the class tokens, palette, and footer layout byte-untouched, so the screenshot fidelity loop never conflicts with engine wiring.
24. As a developer, I want one shared `mm:ss` formatter for every surface reading the Playhead, retiring the twin formatters already drifting.
25. As a maintainer, I want the full pre-commit chain — typecheck, testids, retired-affordances, doc-anchors, dist-fresh — green at the commit that lands this.

## Implementation Decisions

- **The module**: a Transport bridge living on the app side of the seam. Interface = `subscribe(listener) → unsubscribe`, `getSnapshot()`, and the four commands `play · pause · seek · setMasterVolume`. The snapshot is a plain immutable object read with `useSyncExternalStore` semantics (stable reference between changes) so React readers never re-render on an equal snapshot.
- **Snapshot shape** (prototype-derived, decision-bearing):

  ```ts
  interface TransportSnapshot {
    playing: boolean;
    playheadSec: number; // canonical Source Mix seconds, invariant under Time-Stretch (ADR-0013)
    masterVolume: number; // 0..1, the Master bus value, not a footer-local copy
    levels: StereoPeakLevels; // post-fader L/R, the engine's coalesced sample
  }
  ```

- **Live adapter**: created once by App; when the **Stem Player** hands off its bridge (the `onTransportControls` moment) the adapter wires the five existing channels into the snapshot. The player's interface — props, channels, meanings — does not change. The disc's "dispatch play or pause by state" logic and the Space fallback stay where they are (UI-side decisions over a transport that acts); the bridge's `seekToStart` verb rides as `seek(0)` — the shell keeps using the four verbs only.
- **Scripted adapter**: a test-side double satisfying the same interface — it records commands and pushes scripted snapshots. It lives under `src/__tests__` per the mock-separation rule; it is the second adapter that makes the seam real, not hypothetical.
- **App deletes**: `footerTransportPlaying`, `footerMasterVolume`, `footerPeakLevels`, `currentTime` mirror states and the mutable transport ref assigned mid-render. The footer chrome, spine wiring, and clock chip become snapshot readers through one subscription.
- **Seeding rules**: Session restore seeds `masterVolume` and `playheadSec` into the snapshot before the player mounts (the restored Session's mixer values); separation completion resets the snapshot to fresh defaults (playing false, playhead 0, volume 1.0, silent levels); with no player wired, commands are inert no-ops and the snapshot reads idle.
- **Cadence rules (moved, not changed)**: Playhead and phase ride the engine's existing position subscription; levels ride the engine's coalesced levels channel; the mixer bridge feeds master-volume restatements and nothing per-frame; the spine repaint ceiling constant is owned by the Master Waveform and is untouched.
- **Restore pairing**: the snapshot's seeded `masterVolume` comes from the same mixer payload the Session write-side stores — the snapshot never becomes a fourth writer of mixer state; persistence keeps its existing single writer (the mixer bridge) so auto-save cadence is byte-identical.
- **Formatter consolidation**: one shared `mm:ss` formatter serves the clock chip and every Playhead-reading surface (single clamp rule), retiring the twin formatters; the ADR-0013 "no second clock" rule is untouched — the formatter is formatting, not a readout.
- **DOM contract**: every footer `data-testid` (`footer-play-pause`, `footer-master-volume`, `footer-master-percent`, `footer-peak-pips`, the L/R pip pins), every accessible name, the `aria-pressed` pattern, and the native-slider rule (no pseudo-thumb CSS — the retired-affordances ban) stay byte-identical; only the source of the values changes.
- **Record**: an append-only ADR-0013 amendment at porting start ("the shell reads one Transport snapshot; mirror states banned"), authored in the same increment that lands the module. No GLOSSARY change — **Transport** already names the concept; the module takes the glossary's word, the domain concept is unchanged.
- **Tickets**: published 2026-11-06 as five vertical slices (approved re-cut of the original module-first sketch) — 01 the module + scripted adapter + behavior suite landed with its first consumer, the footer disc (ref and play-state mirror die); 02 fader + % readout + Peak Pips on the snapshot (volume/levels mirrors die); 03 spine + clock chip + shared `mm:ss` formatter on the snapshot (`currentTime` mirror dies); 04 restore/separation seeding; 05 verification sweep + ADR-0013 amendment record. 02 and 03 run parallel after 01; 04 is blocked by 01–03; 05 closes.

## Testing Decisions

- **What makes a good test here**: external behavior only — commands crossed in, snapshots observed out, and rendered DOM (accessible names, `aria-pressed`, `%` readout, pip classes) through the snapshot-fed chrome. Never component internals, never engine nodes.
- **New seam — the Transport bridge interface (the only new seam, scripted adapter)**: disc semantics as snapshot facts (play flips `playing`, end-of-track scripted stop flips it back); `seek` lands `playheadSec`; `setMasterVolume` lands `masterVolume` and a scripted restatement flows out to readers; levels pass through coalesced, unmangled; idle snapshot with no adapter wired; seeded snapshot after restore. Prior art to imitate: the mock AudioContext factory's discipline of asserting observable state, and the scripted-worker fakes in `src/__tests__`.
- **Existing seam — whole-App (footer chrome + spine wiring), re-targeted, not relocated**: the pinned footer ids keep their presence assertions and now prove snapshot-fed truth (press disc → `aria-pressed` flips; scripted restatement → `%` readout follows). The ADR-0013 live-mirror test (press play, no mixer event, the spine's `aria-valuenow` walks off its start) survives verbatim at this seam. The `window.AudioContext` class-swapping describes retire in favor of the scripted adapter — the swap exists only to fake engine facts the scripted adapter now supplies.
- **Parity guards, green untouched**: the Stem Player component seam (its bridge-channel tests — the interface under test is unchanged), the 42 engine seam tests, the Master Waveform seam tests (repaint ceiling), the sessionStore mixer-bridge/save-cadence tests, and the keyboard Space test. Their green is the proof the increment moved no meaning across the seam.
- **Fidelity guard**: the stitch-skin loop (desktop 1440×900, mobile 390×844 shots) shows zero class-token diff; the class-token pins retarget only if a value source forced a markup change (expected: none).
- **Gates**: `check:testids` (every presence pin resolves), `check:retired-affordances` (pseudo-thumb ban holds), `check:doc-anchors` (`PLAYHEAD_REPAINT_CEILING_MS = 66` untouched), `check:dist-fresh`, typecheck, full suite — the pre-commit chain is the commit gate as always.

## Out of Scope

- The **Stem Player**'s interface: its props, bridge handoff, and all five channels keep their exact shapes and meanings (ADR-0013). This spec deepens the App side of the seam only.
- Engine internals and the engine's method surface (the 35-method interface shrink is candidate 6 — Speculative, its own future ticket, deliberately sequenced after this one).
- Audio behavior: the master bus graph, gain math, WSOLA/Time-Stretch math, Click Track synthesis, level sampling math — the snapshot reports these facts, it changes none.
- Visual skin: every class token, palette decision, footer geometry, native-slider treatment, and mobile rail layout from the stitch-skin increment (ADR-0014 contract) is byte-untouched.
- Session persistence mechanics, IndexedDB shape, auto-saver debounce, and the mixer bridge's write side (cadence and single-writer rule preserved verbatim).
- The keyboard Space listener's home and guards, the Master Waveform's repaint math, the Peak Pips' tint rules, Hand Calibration, Tempo Detector, Beat Grid machinery, and every export surface.

## Further Notes

- **Hot-zone evidence**: the last 100 commits' footer/transport surgery (the 2026-11-05 footer fixes at the bridge comment sites, the 07j–08h transport amplitudes in ADR-0013's amendment history) is the YAGNI weight for deepening exactly this wiring.
- **Deletion test**: delete the module and its rules reappear at five call sites (footer JSX, spine wiring, clock chip, restore seeding, keyboard fallback) — the complexity concentrates, so the module earns its keep.
- **Seam discipline**: one adapter (live) would be a hypothetical seam; the scripted adapter makes two, and the confirmed seam plan (2026-11-06) is exactly one new seam with every existing seam re-reading the same facts.
- **Sequencing**: candidate 6 (engine interface shrink) is deliberately deferred — the Transport snapshot is the seam it will shrink against.
- **ADR posture**: append-only house format — the ADR-0013 amendment records the deepening; ADR-0008/0013's live decisions (single toggle, one Playhead channel, bridge cadence, live footer chrome) all survive verbatim, which is why no ADR conflict callout is needed.
- The architecture report's "pass-through detritus" item about the twin `mm:ss` formatters is folded into this increment (story 24); the zero-importer re-export stub stays out of scope here.
