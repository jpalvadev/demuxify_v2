# The Player Engine Speaks Commands and Reports One Mixer State

Extends [ADR-0002](./0002-audioworklet-multi-track-pitch-tempo.md) (the playback core), [ADR-0006](./0006-signalsmith-stretch-wasm-time-pitch.md) (Signalsmith WASM stretch integration), [ADR-0010](./0010-client-side-tempo-detection-and-click-track.md) (the Click Track lane), [ADR-0012](./0012-solo-and-mute-are-per-stem-exclusive.md) (solo/mute exclusivity), and [ADR-0013](./0013-mix-tab-cohesion-and-the-single-playhead-readout.md) (Mix Tab cohesion and Transport snapshot).

## Context

Prior to this decision, the **Player Engine** (`StemPlayerEngine` in `src/lib/stemPlayerEngine.ts`) presented a wide surface of 47 public methods: thin getter/setter/toggle triplets for volume, mute, solo, tempo, and pitch, four independent subscription channels, and a row of getters exposing live WebAudio nodes. The **Stem Player** component (`src/components/StemPlayer.tsx`) mirrored nine engine facts in React state, causing post-press re-fetching races and duplicating state. Quantization of tempo (0.05 grid) and pitch (whole semitones) was performed in the UI layer rather than in the playback core, and historical surface (such as retired `getLevelTapNodes`, `getStretchMode`, and deleted backwards-compatibility file `src/components/StemTrack.tsx`) no longer ships.

## Decision

The **Player Engine** collapses its public surface to **commands in, one Mixer State out**:

1. **Read side:** One snapshot (`StemPlayerSnapshot`) read via `snapshot()` and subscribed through `subscribe(listener: (snapshot: StemPlayerSnapshot) => void)`. The snapshot carries:
   - `playing: boolean`
   - `playheadSec: number`
   - `duration: number`
   - `masterVolume: number`
   - `stems: StemMixerStates`
   - `clickTrack: ClickTrackMixerState`
   - `timeStretch: TimeStretchState`
   - `levels: StereoPeakLevels`
   - `stretchMode: "signalsmith" | "wsola" | "basic"`
     Publishing is equality-gated using `stemPlayerSnapshotsEqual`: an equal snapshot never mints a new object and never notifies subscribers, ensuring reference stability for `useSyncExternalStore`.

2. **Command side:** Ten verbs:
   - `play(): Promise<void>`
   - `pause(): void`
   - `seek(canonicalSec: number): void`
   - `applyMixer(command: MixerCommand): void`
   - `applyTimeStretch(command: TimeStretchCommand): void`
   - `applyClickTrack(command: ClickTrackCommand): void`
   - `setBeatGrid(beatGridSec: Float64Array | null): void`
   - `snapshot(): StemPlayerSnapshot`
   - `subscribe(listener: SnapshotListener): () => void`
   - `dispose(): void`
     Plus one async readiness verb: `waitForReady(): Promise<void>`.

3. **Domain rules inside the commands:**
   - Exclusivity (ADR-0012) is enforced inside `applyMixer`: setting `solo: true` drops `muted`, and setting `muted: true` drops `solo`.
   - Clamping and quantization move into `applyTimeStretch`: tempo is clamped to [0.5, 2.0] and quantized to 0.05 steps; pitch is clamped to [-12, 12] and quantized to whole semitones.

4. **The Graph Probe:** Live node getters (`getMasterGainNode`, `getStemGainNode`, `getClickGainNode`, `getAnalyserNode`, `getActiveSources`, `getStretchAdapter`, `getLevelTapNodes`) leave the public interface and are retired from general use. The **single named exception** is `graphProbe(): StemPlayerGraphProbe`, which hands out the node bundle for gain-outcome observicals in tests.

5. **Stem Strip waveform peaks:** `getStemBuffer` is deleted. The Stem Player computes per-Stem waveform peaks directly from the duck-typed `stems` prop via `computeWaveformPeaks`, computed once at mount.

6. **Stem Track re-export deletion:** The unused backwards-compatibility file `src/components/StemTrack.tsx` and its glossary gate exemption in `scripts/check-glossary.mjs` are deleted.

## Considered Options

- **Keep shallow pairs alongside the snapshot** (rejected: preserves the 47-method surface, callers continue bypassing the snapshot).
- **Split snapshots** (separate mixer snapshot vs transport snapshot vs stretch snapshot) (rejected: multiple subscriptions reintroduce tearing across controls).
- **Purge all node exposure including observicals** (rejected: ADR-0012 press-sequence observicals must assert live gain node outcomes directly to prevent self-reporting bias; `graphProbe` serves as the controlled, named seam).
- **UI-side exclusivity and quantization** (rejected: callers can bypass UI arithmetic; engine must guarantee its own honest state invariants).

## Consequences

- The Stem Player component drops all nine local mirror states, subscribing to `engine.subscribe` via `useSyncExternalStore`.
- The Stem Player's outbound channel props and bridge handoff remain byte-unchanged (preserving ADR-0013 contracts).
- Public setters (`setStemVolume`, `setStemMute`, `setStemSolo`, `setTempo`, `setPitch`, etc.) are retired; historical calls in tests are retargeted to commands in / snapshot out.
- The pre-commit chain (`check:glossary`, `check:doc-anchors`, `check:test-fixtures`, `check:testids`, `check:retired-affordances`, `check:dist-fresh`) passes cleanly.
