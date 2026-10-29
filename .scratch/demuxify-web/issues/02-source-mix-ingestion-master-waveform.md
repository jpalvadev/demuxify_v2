# 02: Source Mix Ingestion & Master Waveform Overview

**What to build:** The user selects or drags and drops an audio recording (MP3, WAV, FLAC, AAC, OGG) as the Source Mix; the application decodes the audio into PCM buffers, displays metadata (filename, duration, sample rate), and renders an interactive, scrubbable Master Waveform overview with timeline markers.

**Blocked by:** 01: Project Skeleton, PWA Shell & WebGPU Capability Detection

**Status:** ready-for-agent

- [ ] File dropzone and file picker accept common audio formats (MP3, WAV, FLAC, AAC, OGG) as a Source Mix.
- [ ] Client-side audio decoding into normalized AudioBuffer data with error handling for corrupted files.
- [ ] Canvas-based Master Waveform renderer computes downsampled peak envelope data for performant rendering.
- [ ] Interactive timeline scrubbing on the Master Waveform allowing user click-and-drag position selection.
- [ ] Display card presenting duration, channels, sample rate, and a primary action button to begin separation.
- [ ] Automated tests verifying file acceptance, buffer decoding pipeline, and waveform peak computation.

