# Research: Tempo detection + Click Track for Demuxify Web

Date: 2026-11-01
Question: what are the viable ways to add a **Tempo Detector** and **Click Track** to this client-side PWA, and which fits best?

## Project constraints (established facts)

- Fully client-side PWA, React + Vite + onnxruntime-web, no server round-trips (`docs/adr/0001-pwa-webgpu-onnxruntime.md`).
- Stems and Source Mix already live in memory as `Float32Array` audio at 44.1 kHz (`src/lib/chunkOverlapAdd.ts`, `src/lib/audioDecoder.ts`).
- Existing DSP primitives: radix-2 FFT + STFT (`src/lib/fftRadix2.ts`, `src/lib/stft.ts`), AudioWorklet multi-track player (`src/lib/stemPlayerEngine.ts`).
- Glossary: Stems are `vocals | drums | bass | other`; UI views must be designed via OpenDesign MCP (`CODING_STANDARDS.md` §6, ADR 0007).

## Detection candidates (primary sources)

### 1. `@audio/beat` — pure-JS onsets/tempo/beat-tracking (audiojs)

- Works on raw `Float32Array`/`Float64Array` samples in Node **and browser**; no Web Audio API required. README: https://github.com/audiojs/beat
- Full pipeline `detect()` = spectral-flux onsets (Dixon "Onset Detection Revisited") + comb-filter tempo (Davies & Plumbley / Scheirer) + phase-aligned beat grid; `beatTrack()` = Ellis dynamic-programming tracker (same algorithm as librosa's `beat_track`).
- Its own README benchmark: 100-case synthetic set — `detect`/`beatTrack`/`combTempo` Acc1 87%, Acc2 93%, MAE 8.7 BPM; ~450× faster than real time; full 8-algorithm pass on 8.5 s of audio ≈ 150 ms in browser.
- MIT license. Mono input only — pass one channel.
- Verified fit: consumes exactly the `Float32Array` buffers the app already holds (Source Mix channel or the Drums Stem after separation).

### 2. `realtime-bpm-analyzer` (dlepaux)

- Apache-2.0, zero-dependency TypeScript, AudioWorklet-native; file/stream/microphone detection; also a Node entry `analyzeChannelData(Float32Array, fs)` and a CLI (`realtime-bpm-analyzer-cli`). README: https://github.com/dlepaux/realtime-bpm-analyzer (333 stars, active v5 line)
- MIR/fingerprint-flavoured analysis built for DJ/realtime use; returns ranked BPM candidates with confidence.
- Worklet loads from a `blob:` URL (CSP note documented); fits the repo's AudioWorklet architecture (ADR 0002).

### 3. librosa (Python) — `beat_track` / `feature.tempo`

- `beat_track`: onset strength → tempo via onset correlation → DP peak selection (Ellis, JNMR 2007). Docs: https://librosa.org/doc/0.11.0/generated/librosa.beat.beat_track.html
- `feature.tempo`: tempogram autocorrelation with a pseudo-log-normal prior centered at 120 BPM (resolves octave ambiguity). Docs: https://librosa.org/doc/0.11.0/generated/librosa.feature.tempo.html
- **Empirically verified on this repo's test track** (`audioslave_stone.mp3`, 294.1 s, librosa 1.0.0 on Python 3.14 + ffmpeg/soundfile): full-mix `beat_track` → **107.7 BPM, 503 beats**; low-band (fmax 6 kHz percussion proxy) → **107.7 BPM, 513 beats**, median interval 0.557 s. Consistent grid on a steady rock track.
- Desktop/dev-only: useful as a provisioning-style verification script (`scripts/` pattern already exists), not usable in the browser.

### 4. Essentia (MTG/UPF) — RhythmExtractor2013, Percival, TempoCNN

- Tutorial: https://essentia.upf.edu/tutorial_rhythm_beatdetection.html — `RhythmExtractor2013(method="multifeature")` returns BPM + beat positions + **confidence**; `BeatTrackerDegara` faster variant; `BpmHistogramDescriptors` for tempo-varying tracks.
- `TempoCNN` TF model (`deeptemp-k16-3.pb`, ~1.3 MB download) gives global + local BPM with probabilities — ML-grade tempo.
- C++ with pip wheels: desktop/CLI only; a WASM build is a heavyweight port (protobuf stack). Best-in-class DSP + ML for a sidecar tool, not for the PWA itself.

### 5. Naive Web-Audio histogram detectors

- `web-audio-beat-detector` (chrisguttandin, MIT v8.2.39, registry.npmjs.org) and the older `bpm-detective`: AudioContext decode + AnalyserNode peaks + inter-onset histogram. The realtime-bpm-analyzer README credits these as its inspiration.
- Simple and fast but weakest accuracy class (classic Joe-Sullivan algorithm); drags extra deps (`standard-audio-context`, worker/broker packages). Suitable only as a fallback tier.

### 6. ML-in-browser (TempoCNN → TF.js/ONNX, DeepRhythm)

- Robust for syncopation (reggae/funk/breakbeat) but adds a multi-MB model download and a second inference path next to the existing ONNX Inference Engine. Overkill for steady-tempo material; keep as a future tier.

### 7. Server/API round-trip (e.g. AcousticBrainz/Essentia service)

- Violates the client-side-only invariant (ADR 0001). Rejected.

## Click-track generation candidates

- **Synthesized `Float32Array` metronome** placed on the detected beat grid (short exponentially-decaying burst; lower-pitch accent on the downbeat, meter selector 4/4 / 3/4 / 6/8). No dependency; it is just math over the beat positions the tracker already returns; re-samples cleanly with the existing Time-Stretch path.
- Presenting clicks as a **virtual Stem** in the Stem Player gives mute/solo/mix controls, IndexedDB Session persistence, and WAV/MP3 Export Bundle output for free (`wavEncoder.ts` / `mp3Encoder.worker.ts` already exist).
- A runtime AudioWorklet metronome node would skip the stem model and lose export/Session behavior — inferior fit.
- Recorded metronome sample packs: licensing burden; synthesized clicks are sufficient.

## Recommendation (summary)

1. In-browser detection via **`@audio/beat`** (`detect()` first; `beatTrack()` when rubato matters), run on one Source Mix channel; optionally re-detect on the **Drums Stem** once separation exists — the empirical low-band test confirms the drum-channel path gives a cleaner, equally-consistent grid.
2. Expose ranked BPM candidates + confidence (octave ambiguity is inherent: 107.7 vs 215.4 — Ellis-paper territory) and let the user confirm; default prior ~120 BPM like librosa.
3. Click track = synthesized `Float32Array` metronome on the beat grid, surfaced as a virtual Stem with meter + subdivisions; exportable like every other Stem.
4. Keep a **librosa verification script** next to `scripts/provision_*.py` for CI/test parity against the in-browser implementation (validated today on `audioslave_stone.mp3` @ 107.7 BPM).
5. Any new UI surface (Tempo/Click rail in the Tab Shell) must first come from an OpenDesign run per ADR 0007.
