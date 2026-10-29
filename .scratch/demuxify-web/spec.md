# Spec: Demuxify Web

Status: resolved

## Problem Statement

Musicians, producers, DJs, and vocalists frequently need to isolate individual instruments and vocals from existing recordings for practice, sampling, remixing, transcription, and karaoke. Currently, existing high-quality music source separation solutions (such as Demucs v4) rely on high-end desktop hardware, cumbersome Python environments, or paid server-based web services. Cloud-based tools introduce high latency, subscription paywalls, privacy risks with unreleased music, and require constant high-bandwidth internet connections. Users need a free, private, offline-capable, and responsive tool that runs directly on their local device inside a modern browser, providing instant stem separation alongside a multi-track playback and practice environment with pitch and tempo shifting.

## Solution

Demuxify Web provides a 100% client-side Progressive Web App (PWA) that executes state-of-the-art music source separation directly within the user's browser utilizing WebGPU and ONNX Runtime Web. Users can drag and drop any Source Mix (MP3, WAV, FLAC, etc.) to extract four distinct Stems: Vocals, Drums, Bass, and Other. The separation runs inside a background worker using chunked processing to ensure zero UI freezes, while neural network weights are cached locally in browser storage so subsequent runs operate instantly and fully offline.

Once processed, users interact with a dedicated Stem Player equipped with an interactive Master Waveform for full timeline scrubbing, individual Stem waveforms, synchronized multi-track playback, solo/mute toggles, per-Stem volume controls, and independent pitch (-12 to +12 semitones) and tempo (0.5x to 2.0x) time-stretching powered by an AudioWorklet WSOLA implementation. Sessions and audio buffers are automatically saved to browser storage (IndexedDB/OPFS) to guard against accidental refreshes, and users can export their separated Stems as uncompressed WAV or customizable MP3 files, individually or as a complete compressed Export Bundle.

## User Stories

1. As a musician, I want to open the web app without installing native software or Python dependencies, so that I can immediately start separating audio on any compatible device.
2. As a user on an unreliable connection, I want the web app to install as a PWA and operate offline, so that I can use the tool anywhere without an internet connection.
3. As a privacy-conscious producer, I want all audio separation to execute entirely on my local machine without uploading files to remote servers, so that unreleased tracks remain confidential.
4. As a user, I want the system to check if my browser and hardware support WebGPU before processing begins, so that I receive clear, actionable feedback if acceleration is unavailable.
5. As a user, I want the application to download the neural network model weights on first use and store them in the Model Cache, so that future sessions do not require re-downloading large assets.
6. As a user, I want to see a clear download progress bar and percentage when model weights are being downloaded into the Model Cache, so that I know the download status.
7. As a user, I want to drag and drop or browse to select a Source Mix (MP3, WAV, FLAC, AAC, OGG), so that I can load my audio easily.
8. As a user, I want to see metadata and the Master Waveform of the loaded Source Mix before starting separation, so that I can verify I selected the correct recording.
9. As a user, I want the Inference Engine to process the Source Mix in sequential Chunk Segments inside a dedicated worker, so that the user interface remains smooth and responsive during processing.
10. As a user, I want to view a real-time progress indicator showing elapsed time, estimated remaining time, and currently processed Chunk Segments during separation, so that I understand how long the operation will take.
11. As a user, I want the ability to cancel an ongoing separation task at any time, so that I can free up computing resources if I loaded the wrong Source Mix.
12. As a user, I want the separation process to output four discrete isolated Stems: Vocals, Drums, Bass, and Other, so that I can work with each component independently.
13. As a practicing vocalist, I want to mute the Vocals Stem while playing Drums, Bass, and Other in sync, so that I can sing along to a custom backing track.
14. As a drummer, I want to solo the Drums Stem, so that I can hear the exact drum pattern, ghost notes, and fills clearly.
15. As a bassist, I want to solo the Bass Stem and boost its volume, so that I can transcribe complex basslines accurately.
16. As a producer, I want individual volume faders for each of the four Stems, so that I can adjust the balance of the mix to suit my needs.
17. As a musician, I want synchronized playback across all four Stems with sub-millisecond phase accuracy, so that no phasing artifacts or latency drifts occur between instruments.
18. As a student learning a difficult solo, I want to decrease the playback tempo (down to 0.5x) without altering the pitch, so that I can practice fast passages slowly and cleanly.
19. As a DJ preparing a mix, I want to increase the playback tempo (up to 2.0x) without altering the pitch, so that I can match the BPM of another track.
20. As a singer, I want to shift the musical pitch up or down by semitones (-12 to +12) without altering the tempo, so that I can practice the song in my vocal range.
21. As a user, I want to reset pitch and tempo adjustments to their default values (0 semitones and 1.0x speed) with a single click, so that I can quickly return to the original playback state.
22. As a user, I want to click or drag anywhere along the Master Waveform to scrub playback position across all Stems simultaneously, so that I can navigate quickly through the arrangement.
23. As a user, I want to see synchronized playback cursors moving across both the Master Waveform and individual Stem waveforms, so that I have continuous visual feedback on playback position.
24. As a user, I want to play and pause playback using standard keyboard shortcuts (e.g., Spacebar), so that I can control playback efficiently while holding an instrument.
25. As a mobile or desktop user, I want touch-friendly, high-contrast controls styled with ShadCN UI, so that the interface is accessible and pleasant to use on phones, tablets, and large screens.
26. As a user, I want my active Session (including the Source Mix, separated Stems, playback position, and fader levels) saved automatically in browser storage (IndexedDB/OPFS), so that I do not lose progress if the page is accidentally reloaded or closed.
27. As a user returning to the app, I want to restore my previous Session or start a clean new Session, so that I can pick up where I left off or process a different recording.
28. As a user, I want to export any individual Stem as a high-fidelity 16-bit or 24-bit WAV file, so that I can import it into my digital audio workstation (DAW) with zero quality loss.
29. As a mobile user with limited disk space, I want to export any individual Stem as an MP3 file with selectable bitrate (128 kbps to 320 kbps), so that I can save storage space on my device.
30. As a user, I want MP3 encoding to run in a dedicated background worker, so that exporting audio does not freeze or stutter the user interface.
31. As a DJ or music producer, I want to export all four Stems simultaneously packaged into a single ZIP Export Bundle, so that I can download everything in one organized archive with descriptive filenames.
32. As a user, I want clear toast notifications confirming when exports complete or alerting me if an error occurs, so that I am always aware of system status.

## Implementation Decisions

- **Architecture (PWA Client-Side Only)**: Respecting ADR-0001, Demuxify is structured as a client-side Progressive Web App. No audio or tensor data leaves the client. A Web Worker orchestrates the ONNX Runtime Web execution with the WebGPU execution provider, falling back to WebAssembly CPU execution if WebGPU is unavailable or unsupported on the device.
- **Model Execution & Caching**: HTDemucs v4 FP16 model weights are loaded and cached via the Cache Storage API / Origin Private File System (Model Cache). Inference operates over fixed Chunk Segments with overlap-add blending to avoid boundary discontinuities.
- **Stem Audio Engine**: Respecting ADR-0002, multi-track synchronized playback is implemented using the Web Audio API connected to a custom AudioWorkletNode. The worklet processes WSOLA (Waveform Similarity Overlap-Add) across all 4 Stems concurrently within the high-priority audio rendering thread, ensuring phase coherence and preventing garbage-collection pauses.
- **Time-Stretch Controls**: Pitch shifting (-12 to +12 semitones in 1-semitone steps or fractional cents) and tempo adjustments (0.5x to 2.0x in 0.05x increments) are controlled via AudioParams or message ports communicating directly with the WSOLA worklet node.
- **State & Persistence**: Respecting ADR-0003, active Session state (metadata, audio buffers, mixer levels, playback timestamps) is persisted in IndexedDB and the Origin Private File System (OPFS) for large audio blobs.
- **UI & Accessibility**: Built with ShadCN UI (Tailwind CSS and Radix UI primitives), supporting keyboard navigation, dark/light themes, touch targets (minimum 44x44px), and responsive layouts that adapt from mobile portrait to desktop multi-column views.
- **Waveform Rendering**: High-performance canvas-based rendering for the Master Waveform and per-Stem visual representations, decimate-sampled from raw Float32 audio buffers.
- **Export Pipeline**: Dedicated audio export worker supporting both uncompressed PCM WAV generation and LameJS-based MP3 compression (128, 192, 256, 320 kbps). Bundle packaging bundles all four Stems into a zip file named using the Source Mix title.

## Testing Decisions

- **Testing Philosophy**: Tests must evaluate external user-observable behavior and public domain contracts, rather than implementation details or internal private state.
- **Primary Seams**:
  1. **Application Domain Seam (Highest Seam)**: The top-level application harness driving user-level actions: importing a Source Mix, tracking separation lifecycle events, inspecting Session persistence, issuing Stem Player transport controls (play, pause, seek, volume, mute, solo, pitch, tempo), and triggering exports.
  2. **Inference Engine Adapter Seam**: A clean boundary around chunked inference. In non-GPU test environments, a mock tensor provider verifies chunk segmentation, progress event emissions, cancellation handling, and 4-stem buffer reconstruction without requiring physical WebGPU hardware.
  3. **Audio Engine / Worklet Seam**: A headless audio graph boundary that verifies multi-stem WSOLA parameter updates (time-stretch ratios, semitone offsets, phase synchronization, gain matrix) against audio buffer inputs.
  4. **Persistence Seam**: IndexedDB/OPFS store interface validating Session serialization, hydration, and cleanup.
- **Prior Art**: Modern Web Audio and ONNX worker unit/integration harnesses using Vitest with headless mock audio contexts and fake IndexedDB environments.

## Out of Scope

- Cloud/server-side inference or user accounts/authentication.
- Supporting more than the 4 standard HTDemucs stems (Vocals, Drums, Bass, Other); customized 6-stem or piano/guitar models are deferred.
- Advanced DAW editing capabilities (cutting, slicing, MIDI transcription, automated EQ, reverb effects).
- Real-time live microphone separation or streaming inputs.
- Native mobile app wrapper distribution (e.g. Capacitor/React Native); standard PWA installation is the target distribution model.

## Further Notes

- WebGPU support requires modern browsers (Chrome 113+, Edge 113+, Safari 18+, or Firefox with WebGPU flags enabled). A graceful check and informative UI prompt should inform users if their browser or device does not support WebGPU.
- Memory management is paramount when dealing with multi-channel uncompressed audio in mobile browser tabs; temporary audio buffers during chunk processing must be proactively garbage-collected.

