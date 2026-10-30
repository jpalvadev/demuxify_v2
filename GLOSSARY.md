# Demuxify Web

In-browser client-side music source separation application and multi-track player powered by BS-RoFormer and WebGPU.

## Language

**Stem**:
One of the discrete isolated audio tracks (Vocals, Drums, Bass, Other) separated from an audio mix.
_Avoid_: Track, channel, component, layer

**Source Mix**:
The original unseparated audio recording (MP3, WAV, FLAC, etc.) provided by the user.
_Avoid_: Input file, song, audio file

**Stem Player**:
The multi-track playback interface that synchronizes all stems and provides real-time volume, mute, and solo controls.
_Avoid_: Mixer, audio controls, music player

**Inference Engine**:
The client-side execution runtime running the ONNX neural network model (Studio / BS-RoFormer on desktop, Mobile / MDX-Net on mobile devices) via WebGPU or WebAssembly.
_Avoid_: Demucs runner, RoFormer runner, Demucs, backend, separator

**Model Profile**:
The hardware-adapted neural network specification (Studio Profile for desktop environments with dedicated GPU, Mobile Profile for memory-constrained smartphones and tablets) defining model weights, chunk size, and memory constraints.
_Avoid_: Model type, model variant, quality setting

**Model Cache**:
The persistent browser storage storing the neural network weights to prevent re-downloading across sessions.
_Avoid_: Local storage, temporary cache

**Chunk Segment**:
The audio time slice (in seconds) fed into the inference engine sequentially.
_Avoid_: Window, block, packet

**Time-Stretch**:
Altering audio playback speed without altering the musical pitch, or shifting pitch without altering tempo.
_Avoid_: Resample, fast forward, pitch bend

**Session**:
The active working state containing the Source Mix, separated Stems, playback position, and mixer settings persisted in local storage.
_Avoid_: Project, document, workspace

**Export Bundle**:
The package of separated Stems exported to the user's filesystem as individual files (WAV/MP3) or a compressed archive.
_Avoid_: Download folder, zip file, audio package

**Custom Mixdown**:
A single exported audio file (WAV or MP3) containing a user-selected combination of Stems summed together with custom volume levels and anti-clipping protection (e.g., Karaoke, Instrumental, or Custom Backing Track).
_Avoid_: Mixed track, merged audio, bounce, blended song, exported song

**Master Waveform**:
The full overview visual representation of the audio mix used for primary timeline navigation and scrubbing.
_Avoid_: Timeline bar, progress bar, audio visualizer
