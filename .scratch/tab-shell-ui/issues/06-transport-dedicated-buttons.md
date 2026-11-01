# 06: Transport — dedicated Play / Pause buttons

**What to build:** The Listen Tab's Transport row replaces the single play/pause toggle pill with dedicated Play and Pause buttons plus a seek-to-start control and a mono time readout (current / total), styled as a real app transport. Spacebar play/pause and arrow-key seek (±5s, ±1s with Shift, Home/End) keep working exactly as before; scrubbing on the waveform is preserved. Playback engine behavior is untouched.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] Two distinct accessible Play and Pause buttons plus seek-to-start and mono time readout render in Listen.
- [x] Spacebar, arrow-key and Shift-seek hotkeys still verified at the test seam.
- [x] The Stem Player test seam asserts the two-button Transport and is green.

## Answer

Commit `d853bce` — `feat(tab-shell-ui): ticket 06 - dedicated Play/Pause transport buttons + Listen Tab transport row` (full suite green: 37 files / 284 tests).

- `StemPlayer.tsx`: the single toggle pill is replaced by three dedicated buttons in the Global Transport Bar — Seek to Start (`aria-label="Seek to Start"`, `SkipBack` icon, `onClick={handleReset}`), Play (`aria-label="Play"`, `aria-pressed={isPlaying}`, `onClick={handlePlay}`) and Pause (`aria-label="Pause"`, `aria-pressed={!isPlaying}`, `onClick={handlePause}`). `handlePlay` only starts, `handlePause` only stops; `togglePlayPause` still backs the spacebar hotkey so behavior is identical. Time display restyled as the Bold `.tread` mono readout (`font-mono text-lg font-extrabold`).
- New bridge (same pattern as the ticket-03 export bridge): exported `TransportControls { play, pause, seekToStart }`; StemPlayer registers its actions via `onTransportControls?.({...})` inside the engine-init effect, so the Listen Tab row drives the same `StemPlayerEngine` instance. Engine interface untouched.
- `App.tsx`: `transportActionsRef` captures the bridge at the StemPlayer call site; the Listen Tab panel renders a `role="group" aria-label="Transport"` row (Seek / Play / Pause buttons with mono uppercase labels per the artifact's `.ctl` + `<u>` styling) plus a shared mono readout `current / total` via new module helper `formatTransportTime` (`<p>` of three spans mirroring `.tread` + muted `/`).
- Observable transport state uses `aria-pressed` (never `aria-current`, which the rail focus-count seams rely on).
- Seam migrations: `StemPlayer.test.tsx` toggle test rewritten to dedicated-button clicks asserted via `aria-pressed`; spacebar test asserts both buttons then flips via `aria-pressed`; reset test queries `/seek to start/i`; first-render test now asserts `/^play$/i` + `/^pause$/i` + `/seek to start/i`. New `App.test.tsx` seam asserts Seek/Play/Pause + mono readout (`getAllByText(/\d{2}:\d{2}/).length >= 2`) inside the Listen Tab region, then clicks the Listen Play/Pause buttons and observes the Mix Tab Stem Player Play button's `aria-pressed` flip — proving one shared engine across Tabs.

## Comments

- Design mandate satisfied without a new run: the ticket 01 Bold artifact already designs this view — `data-od-id="transport-row"` with `ctl-seek`/`ctl-play`/`ctl-pause` (56px `.ctl` buttons, mono `<u>` labels, accent-filled Play glyph) and `data-od-id="time-readout"` (`.tread` mono 800-weight `00:00 / 03:07`). Preview: http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html.
- In the vitest browser the RAF tick loop does not advance the engine, so transport assertions rely on the synchronous `setIsPlaying` in handlers + `waitFor`; arrow-key seek tests (±5s / ±1s Shift / Home/End) were left untouched and remain green.
- Keyboard seek lives in `MasterWaveform` (±5s, ±1s with Shift, Home/End) and the spacebar listener in StemPlayer; neither was modified — their seams still pass.
