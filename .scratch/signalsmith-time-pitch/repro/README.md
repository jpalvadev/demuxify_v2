# Tempo/Pitch coupling repro harness (Ticket 05)

Real-browser diagnostics for the Signalsmith Stretch AudioWorklet init hang that
made the engine fall back to `playbackRate` (tempo shifts pitch, pitch inert).
Vitest/jsdom cannot run AudioWorklet + WASM, so this harness drives **headless
Chrome over CDP** directly.

## Files

- `repro.html` — page that loads `repro.ts` as a module (served by the Vite dev server).
- `repro.ts` — test suite exposed as `window.__repro.run(name)`:
  - `env` — AudioContext/AudioWorklet/WASM environment facts.
  - `adapter` — `createMultiTrackStretchAdapter` resolves a real WASM adapter (was hanging).
  - `wsola` — WSOLA worklet registers and plays in-browser.
  - `wasmDirect` — direct Signalsmith factory call.
  - `engine` — full `StemPlayerEngine` with a 440 Hz vocal: measures output frequency for
    (tempo 1.0/pitch 0), (1.0/+3), (1.5/+3). Decoupling ⇒ ~441 Hz, ~528 Hz, ~528 Hz.
  - `offline` / `exportRender` — `renderOfflineStems` WASM offline rendering + frequency check.
  - `workletDiag` — captures the generated worklet blob module (monkey-patched
    `URL.createObjectURL`) and A/B tests factory behavior.
  - `rawFactory` / `dumpRaw` / `dumpCaptured` / `dumpBoth` — verbatim
    `SignalsmithStretch.raw.mjs` copy vs the Vite-optimized module (root-cause evidence:
    the optimized blob calls esbuild's `__publicField`, undefined in worklet scope).
- `cdp-run.mjs` — Node CDP driver: launches headless Chrome (isolated profile, autoplay
  unlocked), attaches, grants synthetic user activation, runs tests via
  `Runtime.evaluate`, writes `results.json`.
- `SignalsmithStretch.raw.mjs` — verbatim copy of `node_modules/signalsmith-stretch/SignalsmithStretch.mjs`
  used for the raw-vs-transformed A/B tests.
- `captured_vite.js` / `captured_raw.js` — captured worklet blob modules (evidence).

## Usage

```bash
# 1) start the dev server (HTTPS via basicSsl)
npm run dev

# 2) run tests (comma-separated names; default: env,adapter,engine)
node .scratch/signalsmith-time-pitch/repro/cdp-run.mjs \
  "https://127.0.0.1:5173/.scratch/signalsmith-time-pitch/repro/repro.html" \
  "env,adapter,engine,exportRender"

# 3) inspect
cat .scratch/signalsmith-time-pitch/repro/results.json
```

Notes:

- Never point the driver at your personal Chrome profile; it uses
  `%TEMP%/chrome-repro-profile` and kills its own instance.
- If port 9333 is stuck: find the PID with `netstat -ano | grep 9333` and
  `taskkill //PID <pid> //T //F` (never by image name).
- Windows Chrome stderr noise about `update_service_dialer_win.cc` is harmless.
