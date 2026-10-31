# Ticket 05: Fix tempo/pitch coupling regression + fine 0.05x tempo steps with +/- steppers

**Status:** Resolved

**What to build:** In a real browser, changing tempo shifted the pitch (classic `playbackRate` coupling) and the pitch control had no audible effect. Root cause must be found, not band-aided. Additionally, tempo stepping must change from 0.25x jumps to 0.05x steps with dedicated minus (`-`) and plus (`+`) buttons flanking the tempo slider (pitch already has steppers).

## Symptoms (user report)

1. `el cambio de tempo cambia el pitch` — tempo slider shifted pitch in lockstep.
2. `el cambio de pitch directamente no funciona` — pitch slider/steppers were inert.
3. Tempo granularity of 0.25x is too coarse; need 0.05x with steppers.

## Root cause (verified in headless Chrome via CDP harness in `repro/`)

The symptom signature matches the `AudioBufferSourceNode.playbackRate` fallback
(`tempo = playbackRate`, pitch ignored). The engine ends up on that fallback because
`StemPlayerEngine.initAudioWorklet` never completes:

1. Vite dev pre-bundles `signalsmith-stretch` with esbuild.
2. esbuild lowers ES class fields to the `__publicField(...)` helper.
3. The library serializes its own class source (`Function.prototype.toString`) into a
   blob module registered with `AudioWorkletGlobalScope`, where `__publicField` is
   undefined.
4. The processor constructor throws inside the worklet; the library's internal
   `Module().then(...)` has no `.catch`, so the rejection is unhandled and the
   `ready` handshake message never posts.
5. The factory promise never settles; `createMultiTrackStretchAdapter` awaits it
   forever, blocking the WSOLA fallback branch too, and the engine silently stays on
   `startFallbackSources()` (playbackRate = tempo → pitch shifts with tempo;
   `setPitch` no-ops).

Proof captured in-browser:

- Vite-optimized factory: promise never settles (timed out); generated worklet blob
  contains `__publicField` calls (see `repro/captured_vite.js`).
- Verbatim library import (raw `.mjs` blob): factory resolves in ~42 ms
  (`repro/captured_raw.js`, `rawFactory` test).

## Fix implemented

1. **`vite.config.ts`** — `optimizeDeps.exclude: ["signalsmith-stretch"]` so the dev
   server serves the library verbatim (root cause removed; comment documents why).
2. **`src/lib/signalsmithStretchAdapter.ts`**
   - `withInitTimeout` (8 s) wraps every factory call (live + offline): a hung
     `ready` handshake now degrades to fallback in finite time.
   - The swallow-all `catch` now logs a `console.warn` (silent degradation was what
     made this invisible).
   - `renderOfflineStems` also uses the timeout guard.
3. **`src/lib/stemPlayerEngine.ts`**
   - WSOLA failure path logs a loud warning (last-resort playbackRate mode = pitch inert).
   - New `getStretchMode(): "signalsmith" | "wsola" | "basic"` for observability/tests.
4. **`src/components/StemPlayer.tsx`**
   - Tempo slider `step="0.05"`; quantization `Math.round(x * 20) / 20` clamped to
     `[0.5, 2.0]` (no float drift like `1.3500000000000001`).
   - `-` / `+` buttons flanking the tempo slider (mirroring pitch steppers), 0.05x per
     click, disabled at boundaries. Presets unchanged (all multiples of 0.05).

## Browser verification (headless Chrome 156 via CDP, `repro/` harness)

- `adapter`: `isFallback: false` in 196 ms (was 125 s timeout).
- `engine`: WSOLA/WASM path active, zero fallback sources; 440 Hz reference tone:
  - tempo 1.0, pitch 0 → ~441 Hz
  - tempo 1.0, pitch +3 → ~528 Hz (pitch works, decoupled)
  - tempo 1.5, pitch +3 → ~528 Hz (tempo no longer moves pitch)
- `exportRender` (offline WASM): 440 Hz → 494 Hz at +2 st, duration ratio 0.659 at 1.5x.

## Acceptance criteria

- [x] Pitch and tempo are fully decoupled in-browser (measured frequency above).
- [x] Pitch changes are audible through slider and steppers.
- [x] Tempo slider uses 0.05x steps with `-` / `+` buttons on both sides, clamped `[0.50x, 2.00x]`.
- [x] Off-grid slider values quantize to the 0.05x grid (1.37 → 1.35).
- [x] Hung worklet handshake degrades to WSOLA in finite time with a console warning.
- [x] Unit tests updated (`stemPlayerTimeStretch.test.tsx` steppers/quantization, `signalsmithStretchAdapter.test.ts` init timeout guard).

## Notes

- Repro harness lives in `.scratch/signalsmith-time-pitch/repro/` (`cdp-run.mjs` +
  `repro.ts`): drives real headless Chrome over CDP; usable to re-verify the fix.
- Vitest/jsdom cannot exercise AudioWorklet/WASM; the repro harness is the browser-
  level regression tool for this ticket.
