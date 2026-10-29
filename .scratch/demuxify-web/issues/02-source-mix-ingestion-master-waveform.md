# 02: Source Mix Ingestion & Master Waveform Overview

**What to build:** The user selects or drags and drops an audio recording (MP3, WAV, FLAC, AAC, OGG) as the Source Mix; the application decodes the audio into PCM buffers, displays metadata (filename, duration, sample rate), and renders an interactive, scrubbable Master Waveform overview with timeline markers.

**Blocked by:** 01: Project Skeleton, PWA Shell & WebGPU Capability Detection

**Status:** resolved

- [x] File dropzone and file picker accept common audio formats (MP3, WAV, FLAC, AAC, OGG) as a Source Mix.
- [x] Client-side audio decoding into normalized AudioBuffer data with error handling for corrupted files.
- [x] Canvas-based Master Waveform renderer computes downsampled peak envelope data for performant rendering.
- [x] Interactive timeline scrubbing on the Master Waveform allowing user click-and-drag position selection.
- [x] Display card presenting duration, channels, sample rate, and a primary action button to begin separation.
- [x] Automated tests verifying file acceptance, buffer decoding pipeline, and waveform peak computation.

## Answer
Implemented audio ingestion and decoding via `src/lib/audioDecoder.ts` producing `AudioBuffer` and metadata. Built `src/lib/waveformPeaks.ts` to compute downsampled peak envelopes across mono and multi-channel audio. Created canvas-based `src/components/MasterWaveform.tsx` supporting high-DPI rendering, time markers, dual played/unplayed shading, playhead cursor, and pointer/keyboard scrubbing. Created `src/components/SourceMixCard.tsx` displaying audio details and initiating separation. Added unit & integration tests covering decoding, envelope calculations, waveform scrubbing, and App workflows (38 passing tests).

