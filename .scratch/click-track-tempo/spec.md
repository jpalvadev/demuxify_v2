# Spec: Tempo Detector & Click Track

Status: ready-for-agent

## Problem Statement

The user separates a Source Mix into Stems and plays them back in the Stem Player, but has no way to learn the Source Mix's tempo (BPM) and no way to hear a metronome aligned to the song — for counting tempo, rehearsing, or laying down tracks against the Drums Stem in a DAW. Today nothing in the app estimates tempo and nothing generates a click.

## Solution

A **Tempo Detector** that runs automatically at decode time on the Source Mix and reports ranked BPM candidates, and a **Click Track** — a synthesized metronome locked to a **Beat Grid** — surfaced as a control rail in the Mix tab beside the Transport, with a selectable **Meter**, mute/volume, Session persistence, and export as its own separate file in the Export Bundle. All of it stays fully client-side, per ADR 0001 and ADR 0010.

## User Stories

1. As a user uploading a Source Mix, I want the Tempo Detector to run automatically at decode time, so that I see the BPM in the Separate tab's status area before Inference Engine separation finishes.
2. As a user, I want the readout to show a top BPM candidate plus ranked alternatives (e.g. 107.7 and its metric doubling 215.4), because a true pulse and its double are genuinely indistinguishable, so that I can pick the feel I actually hear.
3. As a user, I want a confidence value with each candidate, so that I know when the analysis is shaky (syncopated or quiet material) versus solid (steady-tempo rock like the reference track).
4. As a user, I want my chosen candidate to re-lock the Beat Grid to that tempo, so that the clicks land where I counted them.
5. As a user on a low-end device (mobile Model Profile), I want tempo analysis to run off the main thread in a Web Worker, so that the Separate tab's progress and UI never stutter because of it.
6. As a user in the Mix tab, I want a Click Track rail beside the Transport with its own mute and volume controls, so that I can dial the clicks up, down, or off.
7. As a user, I want the Click Track to be off by default and toggled on from the rail, so that opening the Mix tab never surprises me with an unexpected metronome over the Stems.
8. As a user, I want a Meter selector (2/4, 3/4, 4/4, 6/8, default 4/4), so that bars group the way the music does.
9. As a user, I want the downbeat accented with a deeper tone and other beats ticked lighter, so that I can hear bar structure, not just uniform ticks.
10. As a drummer, I want the Click Track generated from Beat Grid beat positions (where beats actually fall, including slight natural fluctuation) and not from a flat BPM formula, so that the click stays aligned with real, human-phrased playing.
11. As a user applying Time-Stretch in the Stem Player, I want the Click Track to speed and slow in lockstep with the Stems, so the grid never drifts from the music at any playback rate.
12. As a user, I want the Click Track to have no independent speed controls at all, so that I can never desync the click from the Source Mix.
13. As a user whose Session has no Stems yet, I want the Tempo Detector's readout visible in the Separate tab while Mix stays grayscaled per the Tab Shell rules, so that tempo information is still useful during and before separation completes.
14. As a user, I want the Click Track controls to exist only inside the unlocked Mix tab, so they surface exactly when they are usable.
15. As a returning user, I want the Session (via the Model Cache-free IndexedDB persistence and Session Recovery) to keep the Tempo Detector candidates, my chosen tempo, the Beat Grid, and the Click Track settings, so a recovered Session resumes with clicks exactly where they were.
16. As a producer exporting to a DAW, I want the Export Bundle to contain the Click Track as its own separate file (same WAV/MP3 choice as the Stems) whenever it is enabled, so that I can drop the click onto its own DAW lane next to the Stems.
17. As a karaoke user building a Custom Mixdown, I want no Click Track ever summed into any mixdown preset (karaoke, instrumental, acapella, minus-drums), so the exported backing track stays clean.
18. As a returning user, I want the Master Waveform to look exactly as before — no beat marks projected onto it — so timeline navigation stays uncluttered.
19. As a developer and a user, I want the Click Track to never masquerade as a Stem: the four Stems identities (Vocals, Drums, Bass, Other) remain the only Stems in every contract (Session, Export Bundle, mixdown presets), so nothing downstream silently gains a fifth track.
20. As a user on a steady-tempo, clear-drum track, I want the click to audibly land with the drums when I solo the Drums Stem plus Click Track, so the feature earns trust on real audio.
21. As a user of ambiguous-tempo audio, I want the Tempo Detector to rank candidates rather than silently picking one number, so a wrong BPM is never presented as certain.
22. As a user, I want the Mix tab rail to look consistent with the rest of the Tab Shell, so the new tool does not feel foreign.

## Implementation Decisions

- **Engine**: `@audio/beat` (pure-JS, MIT; Ellis-DP `beatTrack` + comb-filter `combTempo`/`detect` pipeline) added as one npm dependency. Rejected: realtime-bpm-analyzer (stream/DJ API shape), DIY tracker on our own STFT primitives, server APIs (ADR 0001). Recorded in ADR 0010.
- **One detection pass, at decode time, on one channel of the Source Mix.** No re-detection on the Drums Stem (ADR 0010: empirically the grids agree on the reference track, 107.7 BPM both passes).
- **New worker/client pair** following the established heavy-pass client↔worker pattern: input one channel of decoded Source Mix `Float32Array` at 44.1 kHz; output ranked BPM candidates (top candidate + alternatives, with confidence) and a Beat Grid of beat positions in seconds.
- **User selection re-locks the grid**: choosing a candidate re-runs the tracker with that tempo as the hint, regenerating the Beat Grid (octave ambiguity is a user decision, not an engine guess).
- **Session model gains Tempo Analysis state**: candidates, chosen tempo, Beat Grid — persisted inside the Session like Stems and mixer settings, so Session Recovery restores them.
- **Stem Player engine gains Click Track state parallel to Stem mixer state**: `{ enabled, muted, volume, meter }` with `meter ∈ {2/4, 3/4, 4/4, 6/8}`, default 4/4, default disabled. It is a domain-separate concept from Stem; the `StemName` union (vocals/drums/bass/other) is never widened.
- **Click audio is synthesized, never sampled**: short exponentially-decaying burst per Beat Grid position; deeper/lower tone on downbeats per the Meter's accent pattern; regenerated on Meter change; deterministic from (Beat Grid, Meter).
- **Time-Stretch lock is total**: the Click Track lane follows the Stem Player's stretch transform automatically; it has no rate control of its own (ADR 0010 / story 12).
- **Export Bundle gains a separate Click Track file** (WAV or MP3, matching the Stems' export format) only when enabled; mixdown preset logic and presets untouched; the bundle's Stem packaging contracts unchanged.
- **UI**: new rail in the Mix tab (Click Track toggle + volume + Meter selector + BPM readout) and an informational Tempo Detector line in the Separate tab status area. The Tab Shell keeps exactly four Tabs (ADR 0008); the Transport's definition is untouched. Per ADR 0007, the rail's look must come from a fresh OpenDesign run with the run + preview URL recorded on the ticket before porting into React components.
- **Verification anchor**: `scripts/check_bpm.py` (librosa; verified on this machine: 107.7 BPM / 503 beats on `audioslave_stone.mp3`) follows the existing `scripts/provision_*.py` pattern and is cited by the tests.
- Glossary terms **Tempo Detector**, **Beat Grid**, **Click Track**, **Meter** are already committed in `GLOSSARY.md`; `npm run check:glossary` will police them in `src/`.

## Testing Decisions

- **Only external behavior is tested**: decoded audio samples in → BPM candidates/Beat Grid out; Session in → Session round-trip out; player settings in → exported bundle contents out. No assertions on library internals.
- **Seams (reuse-first, exactly one new)**:
  1. _Real-audio end-to-end pipeline seam_ (existing, already ingests `audioslave_stone.mp3` at its exact 7,059,467-byte size): extend with Beat Grid + Click Track export assertions. Ground truth from `scripts/check_bpm.py`: assert the ranked candidates contain the librosa BPM within an octave-tolerant ±5% window, and exported Click Track intervals match the grid (~0.557 s median at 107.7 BPM). Tolerance, not exact equality: the engine's own README benchmark is Acc1 87%, MAE 8.7 BPM, with inherent octave ambiguity.
  2. _Session store seam_ (existing): round-trip persists Tempo Analysis state and Click Track settings; extends the Session Recovery seam pair.
  3. _Stem Player engine seam_ (existing engine test + existing Time-Stretch test pair): Click Track lane mutes/volumes like a lane; click follows stretch.
  4. _Export Bundle seam_ (existing): bundle contains the extra Click Track file when enabled and not when disabled; mixdown presets unchanged.
  5. _New seam only_: the beat-detection client↔worker pair test, mirroring the existing inference client/worker test pair (worker fallback in headless environments included).
  - Component-level jsdom tests for the new rail follow the existing component `.test.tsx` precedent (e.g. the stem strip/mixer card tests); AudioWorklet/headless fallback mocks already exist in the test setup.
- **Modules tested**: new beat-detection client/worker, session store module, Stem Player engine, bundle/export module, the new rail component. No new test harness; existing vitest + fake-indexeddb setup unchanged.

## Out of Scope

- Re-detection on the Drums Stem after separation (deliberately rejected — ADR 0010).
- ML trackers (TempoCNN, DeepRhythm) and any additional model downloads or Model Profiles.
- Real-time microphone/stream BPM analysis (the rejected engine's domain).
- Beat subdivisions (half/eighth clicks) and any per-instrument count-in patterns.
- Beat marks projected on the Master Waveform.
- Independent tempo/speed controls for the Click Track, and recorded metronome sample packs (licensing).
- Time-varying tempo analysis UI (tempo-change segmentation); the Beat Grid covers rubato at one global tempo.
- Server/API round-trips of any kind (ADR 0001).
- Transport redesign and Separate tab changes beyond the status line.
- Mixdown presets: untouched by this feature.

## Further Notes

- Rated-options research with primary-source citations: `docs/research/2026-11-01-tempo-click-track.md`.
- Decision recorded: `docs/adr/0010-client-side-tempo-detection-and-click-track.md` (engine choice + "Click Track is deliberately not a Stem").
- Ground truth verified on this machine: librosa 1.0.0 reports 107.7 BPM, 503 beats (full mix) / 513 beats (low-band proxy) on the reference `audioslave_stone.mp3`.
- The OpenDesign run for the Mix-tab rail is the first implementation step and must be recorded on its ticket (ADR 0007 flow).
- `@audio/beat` README benchmark: ~450× real-time, full pipeline on 8.5 s audio ≈ 150 ms in-browser — comfortably inside a decode-time pass, safe off-main-thread on mobile Model Profiles.
