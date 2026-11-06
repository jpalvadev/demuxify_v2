# 02: applyTimeStretch — quantization moves in, the reset becomes a command, the strip's stretch faces read the snapshot

**What to build:** Time-Stretch and Pitch-Shift cross the engine as one command: `applyTimeStretch(partial)`
taking `{ tempo?, pitch?, formantPreservation? }`, with the tempo 0.5-step quantization, the whole-semitone
Pitch-Shift rule, and the range clamps moved **from the UI into the command** — the snapshot reports the
applied value. "Reset Pitch & Tempo" becomes `applyTimeStretch({ tempo: 1, pitch: 0 })` (the shipped reset
touches only tempo→1.0 and pitch→0, never Formant Preservation — behavior preserved). `stretchMode` rides
the snapshot, subsuming `getStretchMode` (zero consumers) and `isUsingWorklet` (test-only); readiness keeps
exactly one async verb, `waitForReady(): Promise<void>`; `waitForWorkletReady` dies. The **Stem Player**'s
tempo/pitch/formant mirrors die; the strip's stretch faces read the snapshot. The WebAssembly/WSOLA stretch
math and the adapter delegation stay untouched — the engine keeps delegating.

**Blocked by:** 01 (the snapshot + subscribe channel exists).

**Status:** resolved

- [x] `applyTimeStretch(partial)` on the engine's verb list; quantization (0.5 tempo steps, integer
      semitones) and range clamps enforced inside the command; sliders keep their step attributes and
      visible behavior byte-identically
- [x] `applyTimeStretch({ tempo: 1, pitch: 0 })` is the reset — `resetTimeStretch` leaves the interface
      (its public form), the reset button keeps performing the identical fact, Formant Preservation
      untouched by reset (today's behavior, pinned)
- [x] `stretchMode: "signalsmith" | "wsola" | "basic"` publishes on the snapshot; `getStretchMode` and
      `isUsingWorklet` leave the interface
- [x] `waitForReady(): Promise<void>` is the single async readiness verb; `waitForWorkletReady` dies; the
      signalsmith suite's adapter access moves to the probe **in ticket 04** — until then the suite keeps
      its current access, retargeted in the same commit that mints the probe
- [x] `StemPlayer`: tempo, pitch, formant mirror states deleted; faces read the snapshot; export-panel
      bridge keeps byte-identical `{ mixerStates, masterVolume, timeStretch }` payloads and cadence
- [x] Retarget roster touched here: `stemPlayerEngine.test.ts` stretch tests onto command+snapshot,
      `mobileLightweightEndToEnd.test.ts` (7 — `setTempo`/`getTempo`/`setPitch`/`getPitch` calls become
      command + snapshot reads); `stemPlayerSignalsmith.test.ts` (3) retargeted in ticket 04 with the probe
- [x] Parity guards green untouched: `stemPlayerTimeStretch.test.tsx` (9), `StemPlayer.test.tsx` (21),
      `App.test.tsx` (60)
- [x] Gates green (full chain, dist rebuilt); zero new ids; no view designed — record: "no new look
      rendered; skin byte-untouched"

## Comments

- (agent, at authoring): Q15 settled here — 10 verbs + `waitForReady` as the single async verb (11 total,
  10 sync). `getTimeStretch` stays public only until ticket 04's purge retires it; the snapshot field is
  authoritative from this slice.
- (agent, 2026-11-06, resolved): Landed on `engine-command-surface`. `TimeStretchCommand` exported;
  `applyTimeStretch({ tempo?, pitch?, formantPreservation? })` — quantization + clamps live inside the
  verb. **Discrepancy recorded:** the spec text says tempo quantizes in 0.5 steps, but the shipped
  slider is `step="0.05"` with `Math.round(x*20)/20` clamped to [0.5, 2.0]; byte-identical behavior wins,
  so the verb enforces the **shipped 0.05 grid** (pinned: `applyTimeStretch({ tempo: 1.33 })` → 1.35).
  Whole-semitone pitch rule + [-12, 12] clamp pinned (`{ pitch: 2.7 }` → 3). The shipped reset is the
  `{ tempo: 1, pitch: 0 }` command: it routes to the (now private) `resetTimeStretch` implementation so
  the adapter handoff and the worklet `resetTimeStretch` beat fire exactly as the button performed them,
  and Formant Preservation survives it (pinned). `getStretchMode` is private (zero consumers, snapshot
  field authoritative); `resetTimeStretch` public form retired. `waitForWorkletReady` →
  `waitForReady(): Promise<void>`. `isUsingWorklet` stays public this slice — the signalsmith suite keeps
  its access until ticket 04's probe retargets it (its interface exit lands in 04). StemPlayer's
  tempo/pitch/formant mirrors deleted; faces derive from `snapshot.timeStretch`; handlers collapsed to
  one `applyTimeStretch` each; export bridge echo now a single post-command snapshot read with the
  byte-identical payload. Retargets: engine-suite stretch tests onto command + snapshot (incl.
  quantization pins, worklet port-message pins kept), `mobileLightweightEndToEnd.test.ts` (7
  `setTempo`/`getTempo`/`setPitch`/`getPitch` calls → 4 command + snapshot reads). Parity guards green
  untouched: `stemPlayerTimeStretch.test.tsx` (9), `StemPlayer.test.tsx` (21), `App.test.tsx` (60).
  Suite 390/390; `dist/` rebuilt. Record: **no new look rendered; skin byte-untouched** (no OpenDesign
  run — no view designed).
