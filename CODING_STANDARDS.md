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

## 4. Test Isolation & Mock Separation

- Production web workers (e.g. `src/workers/inference.worker.ts`, `src/workers/mp3Encoder.worker.ts`) must contain real processing code only.
- Test doubles, synthetic DSP generators, and offline mocks belong exclusively in `src/__tests__/` or `src/test/`.
