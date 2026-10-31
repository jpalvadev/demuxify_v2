# Coding Standards

Documented standards and design conventions for Demuxify Web.

## 1. Domain Terminology (`GLOSSARY.md`)

Always use canonical domain terms defined in `GLOSSARY.md`.

- **Stem**: An isolated extracted audio track (Vocals, Drums, Bass, Other). Avoid _Track_, _channel_, _component_, _layer_.
- **Source Mix**: The original unseparated audio recording. Avoid _Input file_, _song_, _audio file_.
- **Stem Player**: The multi-track playback interface. Avoid _Mixer_, _audio controls_, _music player_.
- **Source Mix Title**: Use `sourceMixTitle`, never `songTitle`.
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

## 5. Centralized Model Profiles & Identity (ADR 0005)

- All model profiles, asset URLs (`.onnx`), cache partition keys (`demuxify-*-cache`), execution backends, and UI presentation labels must reside solely in `src/lib/modelConfig.ts`.
- Never hardcode cache names, model asset filenames, or profile tags across consumer components, client classes, or workers.
- Consumers should always query `resolveModelProfile(id)`, `MODEL_PROFILES`, or `DEFAULT_MODEL_PROFILE`.
- Verified by `npm run check:glossary` static analysis.

## 6. UI View Design via OpenDesign MCP (ADR 0007)

- MANDATORY: all views/looks are designed through the OpenDesign MCP (bundled design-system plugin catalog, no external MCPs). Never hand-design UI or layout in code.
- Flow: OpenDesign run produces the artifact in its project → port into the existing React components; the token architecture (shadcn-style HSL CSS variables) and engine logic stay intact.
- If a ticket's view is not covered by an existing OpenDesign artifact, run OpenDesign for that view first and record the run + preview URL on the ticket.
- Tab Shell, Tab, and Transport vocabulary follows `GLOSSARY.md`; the shell decision is recorded in `docs/adr/0007-tab-shell-ui.md`.
