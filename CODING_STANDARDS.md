# Coding Standards

Documented standards and design conventions for Demuxify Web.

## 1. Domain Terminology (`GLOSSARY.md`)

Always use canonical domain terms defined in `GLOSSARY.md`.

- **Stem**: An isolated extracted audio track (Vocals, Drums, Bass, Other). Avoid _Track_, _channel_, _component_, _layer_.
- **Source Mix**: The original unseparated audio recording. Avoid _Input file_, _song_, _audio file_.
- **Stem Player**: The multi-track playback interface. Avoid _Mixer_, _audio controls_, _music player_.
- **Source Mix Title**: Use `sourceMixTitle`, never _songTitle_ (a forbidden term — see `npm run check:glossary`).
- Run `npm run check:glossary` to mechanically verify that no forbidden terms enter `src/`.

## 2. Audio Context Management

- Always use `createAudioContext()` and `getAudioContextClass()` from `src/lib/audioContext.ts`.
- Never duplicate `window.AudioContext || window.webkitAudioContext` inline.
- Audio worklet nodes must gracefully fall back in headless/SSR or mock environments.

## 3. Data Structures & Domain Types

- Avoid data clumps of loosely traveling mixer properties (`volume`, `muted`, `solo`).
- Bundle track settings into `StemMixerSettings` (defined in `sessionStore.ts` / `stemPlayerEngine.ts`).
- Avoid Primitive Obsession for domain identifiers:
  - Use `ModelId` (`'bs-roformer-4stem' | 'htdemucs-4stem'`) instead of raw `string` across worker messages, client APIs, and session metadata.
  - Use `StemName` (`'vocals' | 'drums' | 'bass' | 'other'`) for stem identifiers.

## 4. Test Isolation & Mock Separation

- Production web workers (e.g. `src/workers/inference.worker.ts`, `src/workers/mp3Encoder.worker.ts`) must contain real processing code only.
- Test doubles, synthetic DSP generators, and offline mocks belong exclusively in `src/__tests__/` or `src/test/`.
- Browser storage isolation: tests interacting with persistent storage (`sessionStore` or `fake-indexeddb`) must cleanly isolate state by invoking `clearActiveSession()` before setting up test fixtures and in test cleanups (`afterEach`), ensuring background debounced writes from prior tests never bleed across suites.
- Full-shell startup assertions that await asynchronous initialization (e.g. concurrent WebGPU capability probing and storage inspection) must provide sufficient `waitFor(..., { timeout: 4000 })` headroom under high-concurrency test runs.

## 5. Centralized Model Profiles & Identity (ADR 0005)

- All model profiles, asset URLs (`.onnx`), cache partition keys (`demuxify-*-cache`), execution backends, and UI presentation labels must reside solely in `src/lib/modelConfig.ts`.
- Never hardcode cache names, model asset filenames, or profile tags across consumer components, client classes, or workers.
- Consumers should always query `resolveModelProfile(id)`, `MODEL_PROFILES`, or `DEFAULT_DESKTOP_MODEL_ID`.
- Verified by `npm run check:glossary` static analysis.

## 6. UI View Design via OpenDesign MCP (ADR 0007)

- MANDATORY: all views/looks are designed through the OpenDesign MCP (bundled design-system plugin catalog, no external MCPs). Never hand-design UI or layout in code.
- Flow: OpenDesign run produces the artifact in its project → port into the existing React components; the token architecture (shadcn-style HSL CSS variables) and engine logic stay intact.
- If a ticket's view is not covered by an existing OpenDesign artifact, run OpenDesign for that view first and record the run + preview URL on the ticket.
- Tab Shell, Tab, and Transport vocabulary follows `GLOSSARY.md`; the shell decision is recorded in `docs/adr/0007-tab-shell-ui.md`.
- If the OpenDesign MCP itself fails, follow the recovery procedure in `docs/agents/open-design-mcp.md`; an agent-authored look must be recorded on the ticket as such.

## 7. Async Completion Asserted at the Deepest Resolving Seam

- App-level jsdom tests must not await a completed export/ZIP: jszip's `generateAsync` scheduling never resolves inside the full-App test env (it stalls at "Packaging ZIP bundle..."). This is an environment fact, not a product bug — the same call completes at the component seams.
- At the App seam, spy the bundler (`createStemBundleZip`) and assert its call arguments (format, Click Track bytes): what would be exported, byte-for-byte.
- Assert finished export pipelines at their proper architectural seam per ADR-0017: audio math, format encoders, anti-clipping headroom, and `AbortSignal` are asserted headless in `src/__tests__/exportEngine.test.ts`; UI interactions, form controls, and browser download triggers are asserted in `src/__tests__/ExportTab.test.tsx` / `bundleZip.test.ts`, where the calls demonstrably resolve.

## 8. Shared Test Readers

- Shared test doubles and readers — e.g. the WAV-bytes -> click onsets decoder (`decodeWavOnsets`, `src/__tests__/wavOnsetsHelper.ts`) — live in one module under `src/__tests__/` and every seam that needs one imports it, instead of each test file keeping its own copy of the shape.
- Expectation fixtures must be TYPED constants, not multi-line object literals passed straight to `toEqual`/`toMatch`: hoist them (`const expectedLane: ClickTrackMixerState = { ... }`) so `typecheck` sees drift and vitest failures stay readable. Verified by `npm run check:test-fixtures`.
- Chrome fed by an external store (the Transport snapshot through `useSyncExternalStore`) re-renders after the push lands: at the App seam, assert DOM facts with `await waitFor(…)` — a scripted push is followed by React's concurrent re-render, so a synchronous read right after the push races it.

## 9. Affordance Retirement Turns DOM Assertions into Absence Assertions, Surviving Readouts Stay Pinned

- When a UI affordance is retired (e.g. the Click Track rail's −/+ pair, Meter selector and phase readouts, per the ADR-0011 Amendment), every test that pinned its DOM is rewritten as an ABSENCE assertion: `queryByTestId`/`queryAllByRole` expected `null`/empty, never just deleting the test — a silent deletion blinds the suite to the affordance coming back.
- Readouts that survive the retirement (BPM label, lane on/off, mute, volume — scoped to where they still exist: the Stem lanes' mute is live, while the Click Track lane's mute died per the ADR-0010 Amendment) keep their pinned DOM assertions; a retirement must not weaken what the suite sees around it.
- `getAllByRole` THROWS when empty — absence checks must use the `query*` variants.
- Before touching any rail control, grep `src/__tests__` for its `data-testid`: test files pin these attributes across the suite (see `docs/agents/navigation.md`).
- That pin is gated, not remembered: `npm run check:testids` fails when a PRESENCE accessor (`getByTestId`/`getAllByTestId`/`findByTestId`/`findAllByTestId`) names an id no component renders. The ABSENCE half (`queryByTestId`, `queryAllByTestId`, `filterByTestId`) is exempt on principle — it is the pin that proves a retirement held, so it legitimately names something that no longer exists.
- The other half of a retirement is gated the same way: `npm run check:retired-affordances` bans the deleted affordance from shipped code (the Click Track's accent/Downbeat axis per the `docs/adr/0011-downbeat-reading-and-beat-grid-repair.md` Amendment: a `downbeat`-shaped symbol, a bare `meter` field, the retired rail testids). `src/__tests__` and comments are exempt — absence pins and ADR history are supposed to name what is gone.

## 10. Derivation-Honesty Claims Name the Derivation They Read

- A UI claim about _how_ a value was derived (the rail's readouts: "calibrated by hand", "solid reading", "N readings ranked") must name the derivation that produced the value the component is actually reading — never a derivation that produced an earlier one. This is ADR-0010/ADR-0011's ranking-over-certainty honesty extended to Hand Calibration: no claim may be dressed in a stronger derivation than the one the readout came from.
- When one pass replaces a derivation with another (a tap-confirm supplies a Hand Calibration and re-locks the Beat Grid), commit the value BEFORE the claim renders: value setter first, then claim setter — `setTempoAnalysis` before `setClickCalibration` in `src/App.tsx` — so no frame claims "calibrated by hand" while the old Beat Grid is still what the rail reads.
- Persistence obeys the same rule: a claim is stored only beside the value it describes (`calibration` beside `tempo` on `DemuxifySession`), and superseding one supersedes the other — a stale pairing is never left half-cleared.
- This stays a reviewer rule, not a guardrail: it is about which value a claim refers to, and no check can substitute for reading that intent.

## 11. ADR-Recorded Numbers Are Anchored Constants, Never Bare Prose

- When an ADR records a numeric fact about what the code runs with, it must be written in the pinned shape: a `NAME = <number>` span in the ADR **and** a named `const NAME = <number>` in `src/` the component actually uses — ADR-0011's `SNAP_TOLERANCE_SEC = 0.08` (`src/lib/beatGridRepair.ts`) and ADR-0013's `PLAYHEAD_REPAINT_CEILING_MS = 66` (`src/components/MasterWaveform.tsx`) are the models. `npm run check:doc-anchors` already compares every such span in the ADRs against the constant `src/` runs with; a number outside that shape is simply invisible to the gate.
- The failure this retires is ADR-0013's prose "24" for the Click Track lane's default height: no gate can pin a number in sentences, so the day the value changes the ADR becomes a lie nothing catches. If the number is a value the code reads, lift it to a named const and anchor both sides in the same commit that writes the ADR. If it is a look detail owned by the component (height defaults, spacing), the ADR must still name where the code keeps it — the `height = 24` default at `src/components/BeatGridTapCalibration.tsx:57` — instead of quoting the bare number, so an agent follows the pointer to the real source rather than trusting prose.
- This is an authoring-time discipline; the gate stays unchanged. Drift of an anchored number is a per-commit event (`check:doc-anchors` is in the chain); drift of a prose number is silent forever.

## 12. IndexedDB Connection Lifecycle & Transaction Boundaries

- Any persistence helper that opens and manages its own `IDBDatabase` connection must close `db` (`db.close()`) strictly within transaction terminal events (`tx.oncomplete`, `tx.onerror`, `tx.onabort`), never prematurely inside individual request callbacks (`req.onsuccess`).
- Calling `db.close()` while a transaction is active marks the connection closing, which risks aborting queued operations or dropping events under concurrent load or simulated database adapters (`fake-indexeddb`).
