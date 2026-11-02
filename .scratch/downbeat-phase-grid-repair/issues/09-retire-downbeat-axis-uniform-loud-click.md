# 09: Retire the Downbeat axis and make the Click Track one uniform loud tap

**What to build:** The user no longer hears any difference between clicks and has no way to ask for one. Every Beat Grid position gets the same tap, the tap is clearly louder than it was, and the whole rail surface that used to talk about a strong beat — Meter selector, −/+ pair, "Beat X of Y" readout — is gone. The Beat Grid itself, its repair, and the tempo readout stay exactly as they are.

**Blocked by:** nothing (this closes the axis tickets 02, 04, 05 and 06 opened; it retires them rather than amending them).

**Status:** resolved (landed in one commit on `main`)

- [x] Synthesis contract: `synthesizeClickTrackChannel(beatGridSec, sampleRate, durationSec?)` — one uniform tap per grid position, 640 Hz, amp 1.0, tap length 0.06 → 0.09 s, tail pad 0.09 s. Nothing exceeds 1.0 internally, so the Int16 export never clips; the old off-accent amp was 0.55, so the quiet half of every bar is now ~1.8× louder and every bar sounds the same.
- [x] Worker: `src/workers/beatDetection.worker.ts` no longer imports or runs `pickDownbeatPhase`; the complete message carries no phase; `DEFAULT_CLICK_TRACK_BEATS_PER_BAR` deleted.
- [x] Relay + engine: `TempoAnalysisResult` carries no phase; `ClickTrackMixerState` has only `enabled`/`muted`/`volume`; `getClickTrackDownbeatPhase`/`setClickTrackDownbeatPhase`/`rotateClickTrackDownbeat`/`setClickTrackMeter` and the `downbeatPhase` field are gone from `src/lib/stemPlayerEngine.ts`.
- [x] `src/lib/beatGridRepair.ts` keeps only the repair (`SNAP_TOLERANCE_SEC` + `repairBeatGrid`); `normalizeDownbeatPhase` and the prominence machinery deleted.
- [x] Rail UI: `src/components/StemPlayer.tsx` drops the Meter selector, the −/+ buttons, the `Meter {…}` and `Beat X of Y` labels, the rail's phase state and handlers, and the `initialDownbeatPhase`/`onClickTrackPhaseChange` props. The lane keeps its on/off switch, mute, volume fader, and the tempo readout.
- [x] Session: `sessionStore.ts` writes and reads no `downbeatPhase`, `isValidDownbeatPhase` deleted, `isValidClickTrack` is meter-free. No backwards compatibility — old Sessions that stored a phase or a Meter simply have no such field now, and nothing re-guesses one.
- [x] Export parity: `ExportDialog.tsx` loses the `clickTrackDownbeatPhase` prop and calls the 3-arg synth, so bundle bytes match playback by construction (shared seam, one call signature).
- [x] `src/App.tsx`: all seven `downbeatPhaseRef` sites removed (declaration, completion handler, re-lock session merge, resume seeding, auto-save mirror, rail props, export props).
- [x] Test rework: Meter and −/+ tests and the phase-accent tests deleted; the synth test rewritten as uniform-tone assertions (peaks equal at every grid position, peak > 0.9); `wavOnsetsHelper.ts` stripped of its now-dead peak-level reader; new absence assertions at the rail seams (App, `StemPlayer.test.tsx`, `stemPlayerTimeStretch.test.tsx`) plus the new App-seam test "hosts no Downbeat affordance anymore" (rail live, BPM readout present, every retired testid null, no button phrased around a Downbeat).
- [x] `npm run typecheck`, full vitest suite (347/347, 40 files) and `npm run check:glossary` green on the commit.

## Design record — agent port (dead-MCP fallback)

Per `docs/adr/0007-tab-shell-ui.md` every view change goes through the OpenDesign MCP; the documented exception is a pure removal, and this is one: nothing is redesigned, the Meter selector, the −/+ pair and two mono readout spans are simply deleted from an existing rail whose look already exists on the ticket-01 fallback record. The remaining rail keeps its existing structure (switch, mute, fader, BPM label) untouched, so no new OpenDesign run was needed; the port is recorded here as required by `docs/agents/open-design-mcp.md`.

## Comments

- ADR-0011 carries the Amendment recording why the axis dies and why the repair half survives (`docs/adr/0011-downbeat-reading-and-beat-grid-repair.md`, "the Downbeat axis is retired").
- GLOSSARY: `Meter`, `Downbeat` and `Downbeat Phase` entries deleted; the `Click Track` entry amended to say every click is the same uniform tap.
- Ticket 08 ("Calibrate the Click") stays open and untouched: the four-tap calibration was never requested for implementation, only parked.
