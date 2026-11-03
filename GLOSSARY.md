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
The client-side execution runtime running the ONNX neural network model (Studio / BS-RoFormer on desktop, Balanced / HT-Demucs, or Ultra Fast / Open-Unmix on mobile devices) via WebGPU or WebAssembly.
_Avoid_: RoFormer runner, backend, separator

**Model Profile**:
The hardware-adapted neural network specification (Studio Profile for high-end desktop environments, Balanced Profile for quality-oriented mobile/laptop separation, and Ultra Fast Profile for responsive low-latency separation on mobile devices) defining model weights, chunk size, and memory constraints.
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

**Pitch-Shift**:
Altering the musical pitch (key) of stems or mixes in discrete semitone steps without altering playback speed.
_Avoid_: Pitch bend, detune, transpose slider, key change hack

**Formant Preservation**:
Maintaining vocal tract resonance characteristics during pitch shifting to prevent unnatural vocal timbre distortions ("chipmunk" or cavernous effects).
_Avoid_: Formant filter, vocal enhancer, autotune

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

**Tab Shell**:
The persistent application frame that hosts the Brand Unit and organizes the tools into fixed, mutually exclusive tabs, replacing the single-column card flow and all modal overlays.
_Avoid_: Workspace, menu, dashboard, card stack

**Brand Unit**:
The identity lockup (icon mark, wordmark, status dot, mono tagline) carried inside the Tab Shell chrome — at the head of the rail on desktop and in the top band on mobile — never as a separate page header.
_Avoid_: Header, top bar, sidebar, masthead, logo row

**Tab**:
One of the four persistent, mutually exclusive tool surfaces inside the Tab Shell — Separate, Mix, Export, or System — always visible and never opened as a modal; Mix and Export are unavailable (grayscaled) until Stems exist.
_Avoid_: Modal, popup, overlay, dialog, Listen tab

**Transport**:
The row of dedicated playback controls inside the Stem Player: a single Play/Pause toggle whose icon shows the action coming next, time readout, and Master Volume.
_Avoid_: Separate Play and Pause buttons, seek-to-start button, pill button

**Playhead**:
The single current playback position of a Session, shared by the Master Waveform spine, the Stem strips and the Transport readout: one value, one clock, never two readouts that disagree. Counted in canonical seconds of the Source Mix, invariant under Time-Stretch.
_Avoid_: Timestamp, position marker, progress bar, play marker, current time

**Rail**:
A self-contained control group inside a Tab carrying its own identity and controls (e.g. the Click Track rail: its own on/off, its own volume, its own readout). Distinct from the **Tab Rail**, the chrome's navigation row, which keeps its compound name so the two never collide.
_Avoid_: Panel, card, section, toolbar

**Stem Strip**:
The per-Stem row in the Mix Tab carrying that Stem's volume, mute and solo controls, with its own waveform and its share of the Playhead. The mixer block is four Stem Strips plus at most one lane that is not a Stem (the Click Track).
_Avoid_: Track row, channel, stem card

**Tempo Detector**:
The estimate of a Source Mix's dominant tempo in beats per minute, reported as a top candidate plus ranked alternatives because a true pulse and its metric doubling are genuinely ambiguous, and user-correctable.
_Avoid_: BPM counter, tempo meter, DJ analyzer, beat app

**Beat Grid**:
The estimated beat positions across the full timeline of a Source Mix, carrying where the beats actually fall (including slight natural fluctuation) rather than a flat pulse derived from the tempo number alone.
_Avoid_: Tempo grid, metronome marks, quantized beats, BPM grid

**Click Track**:
A synthesized metronome accompaniment locked to the Beat Grid, played alongside the Stems with its own on/off and volume controls; it accompanies the Stems but is not one, and never one of the four Stems identities. Every click is the same uniform tap, and the lane follows Time-Stretch with no rate control of its own.
_Avoid_: Metronome, fifth stem, drum loop, time track

**Hand Calibration**:
The user's own four-tap reading of a groove — taps struck on the waveform spine from which the engine derives pulse (median of the inter-tap deltas) and the Beat Grid anchor (first tap), then re-anchors the Beat Grid through the same re-lock machinery with the derived BPM as hint. The guaranteed escape hatch when every automatic Tempo Detector reading misses: the rail says "calibrated by hand", never "auto". The _decision_ it produces is a Hand Calibration; the _surface_ that asks for it is the Click Track's calibration tool, named "Calibrate the Click" — the tool name and the decision are one sentence apart, never two features.
_Avoid_: Manual BPM, tap meter, auto calibration, beat adjustment
