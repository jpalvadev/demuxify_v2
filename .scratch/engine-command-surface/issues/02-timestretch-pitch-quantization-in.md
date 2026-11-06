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

**Status:** ready-for-agent

- [ ] `applyTimeStretch(partial)` on the engine's verb list; quantization (0.5 tempo steps, integer
      semitones) and range clamps enforced inside the command; sliders keep their step attributes and
      visible behavior byte-identically
- [ ] `applyTimeStretch({ tempo: 1, pitch: 0 })` is the reset — `resetTimeStretch` leaves the interface
      (its public form), the reset button keeps performing the identical fact, Formant Preservation
      untouched by reset (today's behavior, pinned)
- [ ] `stretchMode: "signalsmith" | "wsola" | "basic"` publishes on the snapshot; `getStretchMode` and
      `isUsingWorklet` leave the interface
- [ ] `waitForReady(): Promise<void>` is the single async readiness verb; `waitForWorkletReady` dies; the
      signalsmith suite's adapter access moves to the probe **in ticket 04** — until then the suite keeps
      its current access, retargeted in the same commit that mints the probe
- [ ] `StemPlayer`: tempo, pitch, formant mirror states deleted; faces read the snapshot; export-panel
      bridge keeps byte-identical `{ mixerStates, masterVolume, timeStretch }` payloads and cadence
- [ ] Retarget roster touched here: `stemPlayerEngine.test.ts` stretch tests onto command+snapshot,
      `mobileLightweightEndToEnd.test.ts` (7 — `setTempo`/`getTempo`/`setPitch`/`getPitch` calls become
      command + snapshot reads); `stemPlayerSignalsmith.test.ts` (3) retargeted in ticket 04 with the probe
- [ ] Parity guards green untouched: `stemPlayerTimeStretch.test.tsx` (9), `StemPlayer.test.tsx` (21),
      `App.test.tsx` (60)
- [ ] Gates green (full chain, dist rebuilt); zero new ids; no view designed — record: "no new look
      rendered; skin byte-untouched"

## Comments

- (agent, at authoring): Q15 settled here — 10 verbs + `waitForReady` as the single async verb (11 total,
  10 sync). `getTimeStretch` stays public only until ticket 04's purge retires it; the snapshot field is
  authoritative from this slice.
