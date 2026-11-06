import { StemName, STEM_NAMES } from "./chunkOverlapAdd";
import { createAudioContext } from "./audioContext";
import {
  registerWsolaAudioWorklet,
  WSOLA_WORKLET_PROCESSOR_NAME,
} from "./wsolaProcessor";
import {
  createMultiTrackStretchAdapter,
  isSignalsmithStretchSupported,
  MultiTrackStretchNode,
} from "./signalsmithStretchAdapter";

export interface StemMixerState {
  volume: number; // 0.0 to 1.0
  muted: boolean;
  solo: boolean;
}

export type StemMixerStates = Record<StemName, StemMixerState>;

export interface TimeStretchState {
  tempo: number; // 0.5 to 2.0
  pitch: number; // -12 to 12 semitones
  formantPreservation?: boolean;
}

// Click Track (ADR-0010): a domain-separate lane, never a Stem. The
// StemName union (vocals/drums/bass/other) is not widened here and
// nowhere else. State is parallel to StemMixerState but has no solo and
// deliberately no rate control of its own: it follows Time-Stretch.
// Mix Rail Tidy-Up (ADR-0010 Amendment): no mute flag either — the lane's
// concept is {enabled, volume}, and volume 0 is its own silence.
export interface ClickTrackMixerState {
  enabled: boolean; // defaults to off: opening the Mix tab never surprises
  volume: number; // 0.0 to 1.0, like a Stem lane
}

// Synthesized clicks (no sampled assets): short exponentially-decaying bursts
// at Beat Grid positions in seconds. Every click is the same uniform tap —
// deterministic from the Beat Grid alone, the Click Track has no accent axis
// (ADR-0011 Amendment). Shared with the Export Bundle seam so exported clicks
// match playback exactly.
export function synthesizeClickTrackChannel(
  beatGridSec: Float64Array,
  sampleRate: number,
  durationSec?: number
): Float32Array {
  let gridEndSec = 0;
  for (let i = 0; i < beatGridSec.length; i++) {
    if (beatGridSec[i] > gridEndSec) gridEndSec = beatGridSec[i];
  }
  const lengthSec = Math.max(durationSec ?? 0, gridEndSec + 0.09);
  const out = new Float32Array(Math.round(lengthSec * sampleRate));

  const tapLength = Math.round(0.09 * sampleRate);
  for (let k = 0; k < beatGridSec.length; k++) {
    const t = beatGridSec[k];
    if (t < 0) continue;
    const start = Math.round(t * sampleRate);
    if (start >= out.length) continue;
    const burst = Math.min(tapLength, out.length - start);
    for (let i = 0; i < burst; i++) {
      const env = Math.exp((-7 * i) / burst);
      out[start + i] += env * Math.sin((2 * Math.PI * 640 * i) / sampleRate);
    }
  }
  return out;
}

// Calibrate the Click (ticket 08): when every automatic reading is wrong, the
// user taps beats on the groove they hear. Pulse and grid anchor come from
// pure arithmetic over the taps — no tracker opinion involved — and the
// rejection is always honest: fewer than 3 taps, any inter-tap gap under
// 0.25 s, or any gap over 2.5 s never becomes a half-calibration, it names
// why it refused. "Anchor" here is grid position only: the Click Track has
// no accent axis to rotate (ADR-0011 Amendment retired it end to end).
export interface CalibratedClickGrid {
  kind: "calibrated";
  pulseSec: number; // median of the consecutive inter-tap deltas
  bpm: number; // 60 / pulseSec: the hint the Beat Grid re-locks at
  anchorSec: number; // first tap: where a Beat Grid beat is pinned
  tapsSec: number[]; // the taps themselves, sorted by position
}

export interface ClickCalibrationRejection {
  kind: "rejected";
  reason: "too-few-taps" | "taps-too-close" | "taps-too-far";
  detailSec: number | null; // the offending gap, when a gap caused it
}

export type ClickCalibrationResult =
  CalibratedClickGrid | ClickCalibrationRejection;

export function calibrateClickGrid(tapsSec: number[]): ClickCalibrationResult {
  const taps = [...tapsSec].sort((a, b) => a - b);
  if (taps.length < 3 || taps.some((t) => !Number.isFinite(t) || t < 0)) {
    return {
      kind: "rejected",
      reason: "too-few-taps",
      detailSec: null,
    };
  }

  const deltas: number[] = [];
  for (let i = 1; i < taps.length; i++) {
    const delta = taps[i] - taps[i - 1];
    // 0.25 s is 240 BPM, 2.5 s is 24 BPM: outside that band the taps stop
    // describing a steady pulse, so nothing is derived from them.
    if (delta < 0.25) {
      return { kind: "rejected", reason: "taps-too-close", detailSec: delta };
    }
    if (delta > 2.5) {
      return { kind: "rejected", reason: "taps-too-far", detailSec: delta };
    }
    deltas.push(delta);
  }

  deltas.sort((a, b) => a - b);
  const mid = deltas.length >> 1;
  const pulseSec =
    deltas.length % 2 === 1 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;

  return {
    kind: "calibrated",
    pulseSec,
    bpm: 60 / pulseSec,
    anchorSec: taps[0],
    tapsSec: taps,
  };
}

// The re-anchor half of the hand calibration: the Beat Grid keeps the
// Detector's actual beat positions (they follow the drums) but slides, as
// one rigid body, by the smallest offset (mod pulse) that lands a beat on the
// tap lattice. Never a re-derivation from BPM: a repaired grid stays repaired.
export function reanchorBeatGridToAnchor(
  beatGridSec: Float64Array,
  pulseSec: number,
  anchorSec: number
): Float64Array {
  const out = new Float64Array(beatGridSec.length);
  for (let i = 0; i < beatGridSec.length; i++) out[i] = beatGridSec[i];
  if (!(pulseSec > 0) || beatGridSec.length === 0) return out;

  let shift = 0;
  let bestFound = false;
  for (let i = 0; i < beatGridSec.length; i++) {
    let candidate = (anchorSec - beatGridSec[i]) % pulseSec;
    if (candidate > pulseSec / 2) candidate -= pulseSec;
    if (candidate < -pulseSec / 2) candidate += pulseSec;
    if (!bestFound || Math.abs(candidate) < Math.abs(shift)) {
      shift = candidate;
      bestFound = true;
    }
  }
  for (let i = 0; i < beatGridSec.length; i++) out[i] += shift;
  return out;
}

export interface StemPlayerEngineOptions {
  audioContext?: AudioContext;
  sampleRate?: number;
  duration?: number;
  initialMixerStates?: StemMixerStates;
  initialMasterVolume?: number;
  initialCurrentTime?: number;
  disableWorklet?: boolean;
  formantPreservation?: boolean;
  stretchAdapter?: MultiTrackStretchNode;
  // Click Track lane (ADR-0010): Beat Grid in seconds + lane state.
  beatGrid?: Float64Array;
  initialClickTrack?: ClickTrackMixerState;
}

export type PositionListener = (timeSec: number) => void;
export type StateListener = (state: StemMixerStates) => void;
export type TimeStretchListener = (state: TimeStretchState) => void;

// Stereo Peak Meters (footer transport, 2026-11-05 user fix): post-fader L/R
// meter levels normalized to 0..1 for the footer's peak pips. The scale floor
// is -60 dBFS; 0 dBFS is the ceiling. The engine owns the measurement (it is
// the only owner of the audio graph); the shell only paints it.
export interface StereoPeakLevels {
  left: number;
  right: number;
}
export type LevelsListener = (levels: StereoPeakLevels) => void;

// Engine Command Surface (ADR-0016): ONE read side. Every fact the Stem Player
// shows is one snapshot read at one instant — published only when a fact
// actually changes, with sub-objects cloned at publish so a reader can never
// mutate engine state through it. transportBridge.ts's snapshotEquals is the
// model: an equal snapshot never publishes and never mints a new object, so
// useSyncExternalStore readers never re-render on no-change. The Beat Grid is
// deliberately absent: shared stage machinery the lane follows, not Mixer State.
export interface StemPlayerSnapshot {
  playing: boolean;
  playheadSec: number; // canonical Source Mix seconds (the Playhead)
  duration: number;
  masterVolume: number; // 0..1, the Master bus
  stems: StemMixerStates; // per-Stem { volume, muted, solo }
  clickTrack: ClickTrackMixerState; // { enabled, volume } — no mute, no solo
  timeStretch: TimeStretchState; // { tempo, pitch, formantPreservation }
  levels: StereoPeakLevels; // post-fader L/R, engine-coalesced
  stretchMode: "signalsmith" | "wsola" | "basic";
}

export type SnapshotListener = (snapshot: StemPlayerSnapshot) => void;

// applyMixer payload (ticket 01): per-Stem volume/mute/solo plus Master volume,
// all optional — a control press sends only the fact it moves.
export interface MixerCommand {
  stems?: Partial<Record<StemName, Partial<StemMixerState>>>;
  masterVolume?: number;
}

function stemMixerStatesEqual(a: StemMixerStates, b: StemMixerStates): boolean {
  return STEM_NAMES.every(
    (stem) =>
      a[stem].volume === b[stem].volume &&
      a[stem].muted === b[stem].muted &&
      a[stem].solo === b[stem].solo
  );
}

function stemPlayerSnapshotsEqual(
  a: StemPlayerSnapshot,
  b: StemPlayerSnapshot
): boolean {
  return (
    a.playing === b.playing &&
    a.playheadSec === b.playheadSec &&
    a.duration === b.duration &&
    a.masterVolume === b.masterVolume &&
    stemMixerStatesEqual(a.stems, b.stems) &&
    a.clickTrack.enabled === b.clickTrack.enabled &&
    a.clickTrack.volume === b.clickTrack.volume &&
    a.timeStretch.tempo === b.timeStretch.tempo &&
    a.timeStretch.pitch === b.timeStretch.pitch &&
    a.timeStretch.formantPreservation === b.timeStretch.formantPreservation &&
    a.levels.left === b.levels.left &&
    a.levels.right === b.levels.right &&
    a.stretchMode === b.stretchMode
  );
}

// Peak meter scale: RMS in [-60, 0] dB maps linearly onto [0, 1].
const PEAK_METER_FLOOR_DB = -60;
// The pips are painted, not sampled per audio frame: coalesce emissions to
// roughly 30/s so listeners never receive more than one update per 30 ms of
// audio-clock time.
const PEAK_METER_EMIT_STEP_SEC = 0.03;
// Per-channel tap: the splitter feeds two mono analysers, each sampling this
// many time-domain frames (Chrome's getFloatTimeDomainData is mono, so the
// per-channel split is what makes a stereo meter possible).
const PEAK_METER_FFT_SIZE = 2048;

function createAudioBufferFromChannels(
  audioContext: AudioContext,
  channels: Float32Array[],
  sampleRate: number
): AudioBuffer {
  const numChannels = channels.length;
  const length = channels[0]?.length ?? 0;
  const buffer = audioContext.createBuffer(numChannels, length, sampleRate);
  for (let c = 0; c < numChannels; c++) {
    buffer.getChannelData(c).set(channels[c]);
  }
  return buffer;
}

export class StemPlayerEngine {
  private audioContext: AudioContext;
  private isOwnContext: boolean = false;
  private masterGainNode: GainNode;
  private stemGainNodes: Record<StemName, GainNode>;
  private stemBuffers: Record<StemName, AudioBuffer>;
  private stemStates: StemMixerStates;
  private masterVolume: number = 1.0;

  private duration: number = 0;
  private currentOffset: number = 0;
  private playStartContextTime: number = 0;
  private playing: boolean = false;
  private activeSources: AudioBufferSourceNode[] = [];

  private animationFrameId: number | null = null;
  private positionListeners: Set<PositionListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private timeStretchListeners: Set<TimeStretchListener> = new Set();
  // Engine Command Surface (ADR-0016): the ONE read channel.
  private snapshotListeners: Set<SnapshotListener> = new Set();
  private currentSnapshot: StemPlayerSnapshot | null = null;

  // Peak meter lane (2026-11-05): a sidecar tap off the master bus — a
  // ChannelSplitterNode feeding one AnalyserNode per channel, sinks only.
  // Optional by construction — environments whose AudioContext mock predates
  // it (jsdom seams) keep the exact pre-fix graph and report a flat 0 level.
  private splitterNode: ChannelSplitterNode | null = null;
  private mergerNode: AudioNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private levelsListeners: Set<LevelsListener> = new Set();
  private levelScratch: Float32Array<ArrayBuffer> | null = null;
  private smoothedLevelL = 0;
  private smoothedLevelR = 0;
  private lastLevelsEmitContextTime = Number.NEGATIVE_INFINITY;

  private tempo: number = 1.0;
  private pitch: number = 0; // semitones (-12 to +12)
  private formantPreservation: boolean = true;
  private stretchAdapter: MultiTrackStretchNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private useWorklet: boolean = false;
  private workletInitPromise: Promise<void> | null = null;
  private isDisposed: boolean = false;

  // Click Track lane (ADR-0010): domain-separate from the StemName identities,
  // synthesized from the Beat Grid, no independent rate control (story 12).
  private sampleRate: number = 44100;
  private clickTrackState: ClickTrackMixerState = {
    enabled: false,
    volume: 1.0,
  };
  private beatGrid: Float64Array | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private clickGainNode: GainNode | null = null;
  private clickSource: AudioBufferSourceNode | null = null;

  constructor(
    stems: Record<StemName, Float32Array[] | AudioBuffer>,
    options?: StemPlayerEngineOptions
  ) {
    if (options?.audioContext) {
      this.audioContext = options.audioContext;
    } else {
      this.audioContext = createAudioContext({
        sampleRate: options?.sampleRate ?? 44100,
      });
      this.isOwnContext = true;
    }

    const sampleRate = options?.sampleRate ?? 44100;
    this.sampleRate = sampleRate;

    // Build Master Gain Node with the 2026-11-05 peak-pip lane. The meter
    // path IS the audible path: splitter → one AnalyserNode per channel →
    // merger → destination. Analysers are pass-through, so what you hear is
    // unchanged. Live Chrome probes pinned the shape: (a) Chrome's
    // AnalyserNode has no getChannelData and downmixes stereo input to mono,
    // so per-channel data needs the splitter; (b) Chrome only pulls
    // analysers that feed the destination — a sidecar sink reads flat zeros;
    // (c) the destination node has ONE input, so the split mono channels are
    // re-packed by a ChannelMerger (input 0 → L, input 1 → R). Contexts
    // without the API keep the byte-original direct masterGain → destination
    // edge (post-fader either way, so Master Volume stays visible on pips).
    this.masterGainNode = this.audioContext.createGain();
    const ctxWithMeter = this.audioContext as AudioContext & {
      createAnalyser?: () => AnalyserNode;
      createChannelSplitter?: (numberOfOutputs: number) => ChannelSplitterNode;
      createChannelMerger?: (numberOfInputs: number) => AudioNode;
    };
    if (
      typeof ctxWithMeter.createAnalyser === "function" &&
      typeof ctxWithMeter.createChannelSplitter === "function" &&
      typeof ctxWithMeter.createChannelMerger === "function"
    ) {
      const splitter = ctxWithMeter.createChannelSplitter(2);
      const merger = ctxWithMeter.createChannelMerger(2);
      const analyserL = ctxWithMeter.createAnalyser();
      const analyserR = ctxWithMeter.createAnalyser();
      analyserL.fftSize = PEAK_METER_FFT_SIZE;
      analyserL.smoothingTimeConstant = 0;
      analyserR.fftSize = PEAK_METER_FFT_SIZE;
      analyserR.smoothingTimeConstant = 0;
      this.splitterNode = splitter;
      this.mergerNode = merger;
      this.analyserL = analyserL;
      this.analyserR = analyserR;
      this.masterGainNode.connect(splitter);
      splitter.connect(analyserL, 0, 0);
      splitter.connect(analyserR, 1, 0);
      analyserL.connect(merger, 0, 0);
      analyserR.connect(merger, 0, 1);
      merger.connect(this.audioContext.destination);
    } else {
      this.masterGainNode.connect(this.audioContext.destination);
    }

    // Initialize stem states and gain nodes
    this.stemStates = options?.initialMixerStates
      ? {
          vocals: { ...options.initialMixerStates.vocals },
          drums: { ...options.initialMixerStates.drums },
          bass: { ...options.initialMixerStates.bass },
          other: { ...options.initialMixerStates.other },
        }
      : {
          vocals: { volume: 1.0, muted: false, solo: false },
          drums: { volume: 1.0, muted: false, solo: false },
          bass: { volume: 1.0, muted: false, solo: false },
          other: { volume: 1.0, muted: false, solo: false },
        };

    // ADR-0012: even init cannot smuggle the solo+mute pair back in.
    for (const name of STEM_NAMES) {
      if (this.stemStates[name].solo) this.stemStates[name].muted = false;
    }

    if (options?.initialMasterVolume !== undefined) {
      this.masterVolume = Math.max(0, Math.min(1, options.initialMasterVolume));
      this.masterGainNode.gain.setValueAtTime(
        this.masterVolume,
        this.audioContext.currentTime
      );
    }

    if (options?.initialCurrentTime !== undefined) {
      this.currentOffset = Math.max(0, options.initialCurrentTime);
    }

    this.stemGainNodes = {} as Record<StemName, GainNode>;
    this.stemBuffers = {} as Record<StemName, AudioBuffer>;

    let maxDuration = options?.duration ?? 0;

    for (const stem of STEM_NAMES) {
      const gainNode = this.audioContext.createGain();
      gainNode.connect(this.masterGainNode);
      this.stemGainNodes[stem] = gainNode;

      const stemData = stems[stem];
      let audioBuffer: AudioBuffer;
      if (stemData && "numberOfChannels" in stemData) {
        audioBuffer = stemData as AudioBuffer;
      } else if (Array.isArray(stemData)) {
        audioBuffer = createAudioBufferFromChannels(
          this.audioContext,
          stemData,
          sampleRate
        );
      } else {
        audioBuffer = this.audioContext.createBuffer(2, 1, sampleRate);
      }

      this.stemBuffers[stem] = audioBuffer;
      if (audioBuffer.duration > maxDuration) {
        maxDuration = audioBuffer.duration;
      }
    }

    this.duration = maxDuration;
    this.applyGainMatrix();
    this.formantPreservation = options?.formantPreservation ?? true;

    // Click Track lane init: only materializes audio-graph nodes when the
    // lane is enabled, so headless/off-lane engines stay untouched.
    if (options?.initialClickTrack) {
      this.clickTrackState = {
        enabled: options.initialClickTrack.enabled,
        volume: Math.max(0, Math.min(1, options.initialClickTrack.volume)),
      };
    }
    if (options?.beatGrid) {
      this.beatGrid = options.beatGrid;
      this.regenerateClickBuffer();
    }
    this.applyClickGain();

    if (options?.stretchAdapter) {
      this.stretchAdapter = options.stretchAdapter;
      this.useWorklet = !options.stretchAdapter.isFallback;
    } else if (!options?.disableWorklet) {
      this.workletInitPromise = this.initAudioWorklet(sampleRate);
    }

    // The first snapshot is minted at construction: snapshot() is always
    // readable, even before any listener attaches (useSyncExternalStore
    // semantics demand a sync, reference-stable read from the first render).
    this.currentSnapshot = this.buildSnapshot();
  }

  private async initAudioWorklet(sampleRate: number): Promise<void> {
    try {
      if (isSignalsmithStretchSupported(this.audioContext)) {
        const adapter = await createMultiTrackStretchAdapter({
          audioContext: this.audioContext,
          sampleRate,
          initialTempo: this.tempo,
          initialPitch: this.pitch,
          formantPreservation: this.formantPreservation,
        });

        if (this.isDisposed) {
          adapter.disconnect();
          return;
        }

        if (!adapter.isFallback) {
          await adapter.loadStems(this.stemBuffers);
          for (const stem of STEM_NAMES) {
            adapter.connectStem(stem, this.stemGainNodes[stem]);
          }

          this.stretchAdapter = adapter;
          this.useWorklet = true;
          // stretchMode is a snapshot fact: the signalsmith handoff changes it.
          this.publish();
          // stretchMode is a snapshot fact: the signalsmith handoff flips it.
          this.publish();

          if (this.playing) {
            const curTime = this.getCurrentTime();
            this.stopActiveSources();
            this.stretchAdapter.seek(curTime);
            this.stretchAdapter.start(this.audioContext.currentTime, curTime);
            this.playStartContextTime = this.audioContext.currentTime;
            this.currentOffset = curTime;
            this.restartClickSource(this.audioContext.currentTime, curTime);
          } else if (this.currentOffset > 0) {
            this.stretchAdapter.seek(this.currentOffset);
          }
          return;
        }
      }
    } catch {
      // Signalsmith Stretch setup failed, proceed to WSOLA fallback
    }

    try {
      const registered = await registerWsolaAudioWorklet(this.audioContext);
      if (!registered || this.isDisposed) return;

      const AudioWorkletNodeClass =
        (window as unknown as { AudioWorkletNode?: typeof AudioWorkletNode })
          .AudioWorkletNode ||
        (
          globalThis as unknown as {
            AudioWorkletNode?: typeof AudioWorkletNode;
          }
        ).AudioWorkletNode;

      if (!AudioWorkletNodeClass || this.isDisposed) return;

      const workletNode = new AudioWorkletNodeClass(
        this.audioContext,
        WSOLA_WORKLET_PROCESSOR_NAME,
        {
          numberOfOutputs: 4,
          outputChannelCount: [2, 2, 2, 2],
        }
      );

      if (this.isDisposed) {
        try {
          workletNode.disconnect();
        } catch {}
        return;
      }

      // Collect 8 channels across the 4 stems
      const stems8: Float32Array[] = [];
      for (const stem of STEM_NAMES) {
        const buf = this.stemBuffers[stem];
        const left = buf.getChannelData(0);
        const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;
        stems8.push(left);
        stems8.push(right);
      }

      workletNode.port.postMessage({
        type: "loadStems",
        stems: stems8,
        sampleRate,
      });

      workletNode.port.postMessage({
        type: "setTempo",
        tempo: this.tempo,
      });

      workletNode.port.postMessage({
        type: "setPitch",
        pitch: this.pitch,
      });

      // Connect 4 stereo outputs to stemGainNodes
      for (let i = 0; i < STEM_NAMES.length; i++) {
        const stem = STEM_NAMES[i];
        workletNode.connect(this.stemGainNodes[stem], i);
      }

      workletNode.port.onmessage = (event) => {
        if (event.data?.type === "ended") {
          if (this.playing) {
            this.pause();
            this.currentOffset = 0;
            this.notifyPosition();
          }
        }
      };

      this.workletNode = workletNode;
      this.useWorklet = true;
      // stretchMode is a snapshot fact: the WSOLA handoff changes it.
      this.publish();
      // stretchMode is a snapshot fact: the WSOLA handoff flips it.
      this.publish();

      // If active playback was started via fallback sources while worklet was loading,
      // seamlessly migrate active playback into the worklet without ghost sources!
      if (this.playing) {
        const curTime = this.getCurrentTime();
        this.stopActiveSources();
        this.workletNode.port.postMessage({ type: "seek", timeSec: curTime });
        this.workletNode.port.postMessage({ type: "play" });
        this.playStartContextTime = this.audioContext.currentTime;
        this.currentOffset = curTime;
        this.restartClickSource(this.audioContext.currentTime, curTime);
      } else if (this.currentOffset > 0) {
        this.workletNode.port.postMessage({
          type: "seek",
          timeSec: this.currentOffset,
        });
      }
    } catch (error) {
      // AudioWorklet initialization failed, basic playbackRate fallback remains active
      console.warn(
        "[demuxify] WSOLA worklet unavailable; playback falls back to playbackRate (tempo changes will shift pitch, pitch control is inert).",
        error
      );
      this.useWorklet = false;
      this.workletNode = null;
      // stretchMode settles to 'basic' — the snapshot reports it.
      this.publish();
    }
  }

  public getAudioContext(): AudioContext {
    return this.audioContext;
  }

  public getMasterGainNode(): GainNode {
    return this.masterGainNode;
  }

  public getStemGainNode(stem: StemName): GainNode {
    return this.stemGainNodes[stem];
  }

  public getStemBuffer(stem: StemName): AudioBuffer {
    return this.stemBuffers[stem];
  }

  public getDuration(): number {
    return this.duration;
  }

  public getCurrentTime(): number {
    if (this.playing) {
      const elapsed =
        (this.audioContext.currentTime - this.playStartContextTime) *
        this.tempo;
      return Math.min(this.duration, Math.max(0, this.currentOffset + elapsed));
    }
    return this.currentOffset;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  // --- Engine Command Surface read side (ADR-0016) ---------------------------
  // One snapshot, one subscription, publish-on-change. transportBridge.ts's
  // snapshotEquals discipline: an equal snapshot never publishes and never
  // mints a new object, so useSyncExternalStore readers never re-render on
  // no-change; sub-objects are cloned at publish (getAllStemStates/
  // getClickTrackState/getLevels each return a fresh copy), so a reader can
  // never mutate engine state through the snapshot.

  private buildSnapshot(): StemPlayerSnapshot {
    return {
      playing: this.playing,
      playheadSec: this.getCurrentTime(),
      duration: this.duration,
      masterVolume: this.masterVolume,
      stems: this.getAllStemStates(),
      clickTrack: this.getClickTrackState(),
      timeStretch: {
        tempo: this.tempo,
        pitch: this.pitch,
        formantPreservation: this.formantPreservation,
      },
      levels: this.getLevels(),
      stretchMode: this.getStretchMode(),
    };
  }

  private publish(): void {
    const next = this.buildSnapshot();
    const current = this.currentSnapshot;
    if (current !== null && stemPlayerSnapshotsEqual(current, next)) {
      return; // equal → no publish, no new object
    }
    this.currentSnapshot = next;
    for (const listener of this.snapshotListeners) {
      listener(next);
    }
  }

  /** The sync read: the current snapshot, reference-stable between publishes. */
  public snapshot(): StemPlayerSnapshot {
    if (this.currentSnapshot === null) {
      this.currentSnapshot = this.buildSnapshot();
    }
    return this.currentSnapshot;
  }

  /** The engine's one read channel: called on every published change. */
  public subscribe(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  public getStemState(stem: StemName): StemMixerState {
    return { ...this.stemStates[stem] };
  }

  public getAllStemStates(): StemMixerStates {
    return {
      vocals: { ...this.stemStates.vocals },
      drums: { ...this.stemStates.drums },
      bass: { ...this.stemStates.bass },
      other: { ...this.stemStates.other },
    };
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.masterGainNode.gain.setValueAtTime(
      this.masterVolume,
      this.audioContext.currentTime
    );
    this.publish();
  }

  public setStemVolume(stem: StemName, volume: number): void {
    this.stemStates[stem].volume = Math.max(0, Math.min(1, volume));
    this.applyGainMatrix();
    this.notifyState();
  }

  public setStemMute(stem: StemName, muted: boolean): void {
    this.stemStates[stem].muted = muted;
    // ADR-0012: solo and mute are per-Stem exclusive, last press wins —
    // pressing mute drops a held solo, so the matrix never falls to the
    // all-silent pair state.
    if (muted) this.stemStates[stem].solo = false;
    this.applyGainMatrix();
    this.notifyState();
  }

  public toggleStemMute(stem: StemName): void {
    this.setStemMute(stem, !this.stemStates[stem].muted);
  }

  public setStemSolo(stem: StemName, solo: boolean): void {
    this.stemStates[stem].solo = solo;
    // ADR-0012: pressing solo clears a held mute — the last press wins.
    if (solo) this.stemStates[stem].muted = false;
    this.applyGainMatrix();
    this.notifyState();
  }

  public toggleStemSolo(stem: StemName): void {
    this.setStemSolo(stem, !this.stemStates[stem].solo);
  }

  /**
   * The mixer command (ADR-0016): per-Stem { volume?, muted?, solo? } plus
   * Master volume, applied in one step with one publish. ADR-0012's per-Stem
   * exclusivity resolves inside the command — setStemMute/setStemSolo (the
   * enforcement names the ADR cites) clear the opposite flag, and the gain
   * matrix the setters drive already silences the solo-shaded lanes.
   */
  public applyMixer(command: MixerCommand): void {
    if (command.stems) {
      for (const stem of STEM_NAMES) {
        const partial = command.stems[stem];
        if (!partial) continue;
        if (partial.volume !== undefined)
          this.setStemVolume(stem, partial.volume);
        if (partial.muted !== undefined) this.setStemMute(stem, partial.muted);
        if (partial.solo !== undefined) this.setStemSolo(stem, partial.solo);
      }
    }
    if (command.masterVolume !== undefined) {
      this.setMasterVolume(command.masterVolume);
    }
    this.publish();
  }

  // --- Click Track lane (ADR-0010) -----------------------------------------
  // Domain-separate: never a StemName identity, never part of the gain matrix
  // solo logic; enabling/disabling cannot touch the four Stems' playback.

  public getClickTrackState(): ClickTrackMixerState {
    return { ...this.clickTrackState };
  }

  public getBeatGrid(): Float64Array | null {
    return this.beatGrid;
  }

  public getClickGainNode(): GainNode | null {
    return this.clickGainNode;
  }

  public setBeatGrid(beatGridSec: Float64Array | null): void {
    this.beatGrid = beatGridSec;
    this.regenerateClickBuffer();
    if (this.playing) {
      this.reanchorClickOnLivePlayhead();
    }
  }

  public setClickTrackEnabled(enabled: boolean): void {
    if (this.clickTrackState.enabled === enabled) return;
    this.clickTrackState.enabled = enabled;
    this.applyClickGain();
    if (enabled) {
      this.regenerateClickBuffer();
      if (this.playing) {
        // Anchor at the live playhead: mid-playback toggling must resume where
        // the Stems actually are, not at the last play/seek position (the
        // stale currentOffset only tracks starts, like setTempo's re-lock does).
        this.reanchorClickOnLivePlayhead();
      }
    } else {
      this.stopClickSource();
    }
    this.publish();
  }

  public toggleClickTrack(): void {
    this.setClickTrackEnabled(!this.clickTrackState.enabled);
  }

  // Mix Rail Tidy-Up (ticket 03, ADR-0010 Amendment): there is no setClickTrackMuted
  // and no toggleClickTrackMute anymore — the lane has no mute concept to set.
  public setClickTrackVolume(volume: number): void {
    this.clickTrackState.volume = Math.max(0, Math.min(1, volume));
    this.applyClickGain();
    this.publish();
  }

  private applyClickGain(): void {
    if (this.clickGainNode === null) {
      // Lazy: nodes only materialize once the lane is enabled, keeping the
      // default Stem graph (and its test counts) untouched.
      if (!this.clickTrackState.enabled) return;
      this.clickGainNode = this.audioContext.createGain();
      this.clickGainNode.connect(this.masterGainNode);
    }
    const effectiveGain = this.clickTrackState.enabled
      ? this.clickTrackState.volume
      : 0;
    this.clickGainNode.gain.setValueAtTime(
      effectiveGain,
      this.audioContext.currentTime
    );
  }

  private regenerateClickBuffer(): void {
    // Lazy: the click channel only materializes while the lane is enabled, so a
    // disabled lane never allocates a full-length channel over the Source Mix.
    if (!this.beatGrid || !this.clickTrackState.enabled) {
      this.clickBuffer = null;
      return;
    }
    const samples = synthesizeClickTrackChannel(
      this.beatGrid,
      this.sampleRate,
      this.duration
    );
    const buffer = this.audioContext.createBuffer(
      1,
      samples.length,
      this.sampleRate
    );
    buffer.getChannelData(0).set(samples);
    this.clickBuffer = buffer;
  }

  // Shared re-anchor for every mid-playback Click Track lane edit (enable,
  // volume, Beat Grid re-lock): the lane relays from the live playhead, never
  // the stale currentOffset, so it can't shift off the Stems.
  private reanchorClickOnLivePlayhead(): void {
    this.restartClickSource(
      this.audioContext.currentTime,
      this.getCurrentTime()
    );
  }

  private restartClickSource(startTime: number, offset: number): void {
    this.stopClickSource();
    if (!this.clickTrackState.enabled || !this.clickBuffer) return;
    this.applyClickGain();

    const source = this.audioContext.createBufferSource();
    source.buffer = this.clickBuffer;
    if (source.playbackRate) {
      source.playbackRate.setValueAtTime(this.tempo, startTime);
    }
    source.connect(this.clickGainNode ?? this.masterGainNode);
    source.start(startTime, offset);
    this.clickSource = source;
    this.activeSources.push(source);
  }

  private stopClickSource(): void {
    if (!this.clickSource) return;
    try {
      this.clickSource.stop();
      this.clickSource.disconnect();
    } catch {
      // Source may already be stopped
    }
    // The lane source leaves the active set with the lane: the Stems' entries
    // are untouched, so getActiveSources() never grows a stale click entry.
    const at = this.activeSources.indexOf(this.clickSource);
    if (at !== -1) this.activeSources.splice(at, 1);
    this.clickSource = null;
  }

  private applyGainMatrix(): void {
    const hasAnySolo = STEM_NAMES.some((stem) => this.stemStates[stem].solo);

    for (const stem of STEM_NAMES) {
      const state = this.stemStates[stem];
      let effectiveGain = 0;

      if (hasAnySolo) {
        if (state.solo && !state.muted) {
          effectiveGain = state.volume;
        } else {
          effectiveGain = 0;
        }
      } else {
        if (!state.muted) {
          effectiveGain = state.volume;
        } else {
          effectiveGain = 0;
        }
      }

      this.stemGainNodes[stem].gain.setValueAtTime(
        effectiveGain,
        this.audioContext.currentTime
      );
    }
  }

  public async play(): Promise<void> {
    if (this.playing) return;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    if (this.currentOffset >= this.duration) {
      this.currentOffset = 0;
    }

    const startTime = this.audioContext.currentTime;
    this.playStartContextTime = startTime;
    const offset = this.currentOffset;

    this.stopActiveSources();

    if (
      this.useWorklet &&
      this.stretchAdapter &&
      !this.stretchAdapter.isFallback
    ) {
      this.stretchAdapter.seek(offset);
      this.stretchAdapter.setTempo(this.tempo);
      this.stretchAdapter.setPitch(this.pitch);
      this.stretchAdapter.setFormantPreservation(this.formantPreservation);
      this.stretchAdapter.start(startTime, offset);
    } else if (this.useWorklet && this.workletNode) {
      this.workletNode.port.postMessage({ type: "seek", timeSec: offset });
      this.workletNode.port.postMessage({
        type: "setTempo",
        tempo: this.tempo,
      });
      this.workletNode.port.postMessage({
        type: "setPitch",
        pitch: this.pitch,
      });
      this.workletNode.port.postMessage({ type: "play" });
    } else {
      this.startFallbackSources(offset, startTime);
    }

    // Click lane starts on the same timeline as the Stems: same offset, same
    // rate (playbackRate = tempo), no independent speed control.
    this.restartClickSource(startTime, offset);

    this.playing = true;
    this.startPositionLoop();
    this.notifyPosition();
  }

  public pause(): void {
    if (!this.playing) return;

    this.currentOffset = this.getCurrentTime();

    if (
      this.useWorklet &&
      this.stretchAdapter &&
      !this.stretchAdapter.isFallback
    ) {
      this.stretchAdapter.stop();
    } else if (this.useWorklet && this.workletNode) {
      this.workletNode.port.postMessage({ type: "pause" });
    }
    this.stopActiveSources();

    this.playing = false;
    this.stopPositionLoop();
    this.notifyPosition();
    // Paused: the meters fall silent immediately (no frozen last-frame bars).
    this.smoothedLevelL = 0;
    this.smoothedLevelR = 0;
    this.notifyLevels(true);
  }

  public seek(timeSec: number): void {
    const clampedTime = Math.max(0, Math.min(this.duration, timeSec));
    this.currentOffset = clampedTime;
    const startTime = this.audioContext.currentTime;
    this.playStartContextTime = startTime;

    // Immediately stop any active buffer sources so audio never sticks to old positions
    this.stopActiveSources();

    if (
      this.useWorklet &&
      this.stretchAdapter &&
      !this.stretchAdapter.isFallback
    ) {
      this.stretchAdapter.seek(clampedTime);
      if (this.playing) {
        this.stretchAdapter.start(startTime, clampedTime);
      }
    } else if (this.useWorklet && this.workletNode) {
      this.workletNode.port.postMessage({ type: "seek", timeSec: clampedTime });
      if (this.playing) {
        this.workletNode.port.postMessage({ type: "play" });
      }
    } else if (this.playing) {
      this.startFallbackSources(clampedTime, startTime);
    }

    if (this.playing) {
      this.restartClickSource(startTime, clampedTime);
    }

    this.notifyPosition();
  }

  private startFallbackSources(offset: number, startTime: number): void {
    const sources: AudioBufferSourceNode[] = [];
    for (const stem of STEM_NAMES) {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.stemBuffers[stem];
      if (source.playbackRate) {
        source.playbackRate.setValueAtTime(this.tempo, startTime);
      }
      source.connect(this.stemGainNodes[stem]);
      source.start(startTime, offset);
      sources.push(source);
    }
    this.activeSources = sources;
    this.setupSourcesEndedListener(sources);
  }

  private setupSourcesEndedListener(sources: AudioBufferSourceNode[]): void {
    if (sources[0]) {
      sources[0].onended = () => {
        if (this.playing && this.getCurrentTime() >= this.duration - 0.05) {
          this.pause();
          this.currentOffset = 0;
          this.notifyPosition();
        }
      };
    }
  }

  private stopActiveSources(): void {
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Source may already be stopped
      }
    }
    this.activeSources = [];
    // Click lane sources are stopped with the same sweep (ADR-0010 lockstep);
    // the field is cleared so a later restart never double-stops.
    this.clickSource = null;
  }

  private startPositionLoop(): void {
    this.stopPositionLoop();
    const tick = () => {
      if (this.playing) {
        const curTime = this.getCurrentTime();
        if (this.duration > 0 && curTime >= this.duration) {
          this.pause();
          this.currentOffset = 0;
          this.notifyPosition();
          return;
        }
        this.notifyPosition();
        this.notifyLevels();
        if (
          typeof window !== "undefined" &&
          typeof window.requestAnimationFrame === "function"
        ) {
          this.animationFrameId = window.requestAnimationFrame(tick);
        }
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      this.animationFrameId = window.requestAnimationFrame(tick);
    }
  }

  private stopPositionLoop(): void {
    if (
      this.animationFrameId !== null &&
      typeof window !== "undefined" &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public subscribePosition(listener: PositionListener): () => void {
    this.positionListeners.add(listener);
    listener(this.getCurrentTime());
    return () => {
      this.positionListeners.delete(listener);
    };
  }

  public subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getAllStemStates());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserL;
  }

  public getLevelTapNodes(): {
    splitter: ChannelSplitterNode | null;
    merger: AudioNode | null;
    left: AnalyserNode | null;
    right: AnalyserNode | null;
  } {
    return {
      splitter: this.splitterNode,
      merger: this.mergerNode,
      left: this.analyserL,
      right: this.analyserR,
    };
  }

  public getLevels(): StereoPeakLevels {
    return { left: this.smoothedLevelL, right: this.smoothedLevelR };
  }

  public subscribeLevels(listener: LevelsListener): () => void {
    this.levelsListeners.add(listener);
    listener(this.getLevels());
    return () => {
      this.levelsListeners.delete(listener);
    };
  }

  private notifyLevels(force = false): void {
    if (this.levelsListeners.size === 0) return;
    const now = this.audioContext.currentTime;
    if (
      !force &&
      now - this.lastLevelsEmitContextTime < PEAK_METER_EMIT_STEP_SEC
    ) {
      return;
    }
    this.lastLevelsEmitContextTime = now;
    if (this.analyserL && this.analyserR && this.playing) {
      this.sampleAnalyser(this.analyserL, this.analyserR);
    } else {
      this.smoothedLevelL = 0;
      this.smoothedLevelR = 0;
    }
    const levels = this.getLevels();
    for (const listener of this.levelsListeners) {
      listener(levels);
    }
    this.publish();
  }

  private sampleChannelAnalyser(
    analyser: AnalyserNode,
    scratch: Float32Array<ArrayBuffer>
  ): number {
    // Chrome's AnalyserNode has NO getChannelData (live probe 2026-11-05:
    // undefined in real Chrome); getFloatTimeDomainData is the cross-browser
    // sampler. Keep the getChannelData copyTo shape as a fallback for the
    // test doubles that model the Firefox-era signature.
    const legacy = analyser as AnalyserNode & {
      getChannelData?: (copyTo: Float32Array) => Float32Array | void;
    };
    let sampled = false;
    if (typeof analyser.getFloatTimeDomainData === "function") {
      analyser.getFloatTimeDomainData(scratch);
      sampled = true;
    } else if (typeof legacy.getChannelData === "function") {
      const copied = legacy.getChannelData(scratch);
      if (copied instanceof Float32Array && copied.length === scratch.length) {
        scratch.set(copied);
      }
      sampled = true;
    }
    if (!sampled) return 0;

    let sumSquares = 0;
    for (let i = 0; i < scratch.length; i++) {
      sumSquares += scratch[i] * scratch[i];
    }
    const rms = Math.sqrt(sumSquares / scratch.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : PEAK_METER_FLOOR_DB;
    return Math.max(
      0,
      Math.min(1, (db - PEAK_METER_FLOOR_DB) / -PEAK_METER_FLOOR_DB)
    );
  }

  private sampleAnalyser(
    analyserL: AnalyserNode,
    analyserR: AnalyserNode
  ): void {
    const size = Math.max(analyserL.fftSize || 2048, analyserR.fftSize || 2048);
    if (!this.levelScratch || this.levelScratch.length !== size) {
      this.levelScratch = new Float32Array(size);
    }
    const scratch = this.levelScratch;
    const readings = [
      this.sampleChannelAnalyser(analyserL, scratch),
      this.sampleChannelAnalyser(analyserR, scratch),
    ];

    // Fast attack, slow release: pips jump up with the transient and slide
    // down smoothly, the classic meter feel.
    for (let channel = 0; channel < 2; channel++) {
      const norm = readings[channel];
      const prev = channel === 0 ? this.smoothedLevelL : this.smoothedLevelR;
      const next =
        norm >= prev
          ? prev + (norm - prev) * 0.55
          : prev + (norm - prev) * 0.12;
      if (channel === 0) {
        this.smoothedLevelL = next;
      } else {
        this.smoothedLevelR = next;
      }
    }
  }

  private notifyPosition(): void {
    const curTime = this.getCurrentTime();
    for (const listener of this.positionListeners) {
      listener(curTime);
    }
    // ADR-0016: the Playhead rides the one snapshot (the player already
    // re-renders per frame today — the cadence is not new).
    this.publish();
  }

  private notifyState(): void {
    const states = this.getAllStemStates();
    for (const listener of this.stateListeners) {
      listener(states);
    }
    this.publish();
  }

  public getTempo(): number {
    return this.tempo;
  }

  public setTempo(tempo: number): void {
    const clamped = Math.max(0.5, Math.min(2.0, tempo));
    if (this.playing) {
      this.currentOffset = this.getCurrentTime();
      this.playStartContextTime = this.audioContext.currentTime;
      // In fallback mode only, update playbackRate on active buffer sources
      if (!this.useWorklet || (!this.workletNode && !this.stretchAdapter)) {
        for (const source of this.activeSources) {
          if (source.playbackRate) {
            source.playbackRate.setValueAtTime(
              clamped,
              this.audioContext.currentTime
            );
          }
        }
      }
    }
    this.tempo = clamped;
    if (
      this.useWorklet &&
      this.stretchAdapter &&
      !this.stretchAdapter.isFallback
    ) {
      this.stretchAdapter.setTempo(clamped);
    } else if (this.useWorklet && this.workletNode) {
      this.workletNode.port.postMessage({ type: "setTempo", tempo: clamped });
    }

    // Click Track Time-Stretch lock (ADR-0010 story 12): the lane follows the
    // shared tempo in every mode. In worklet modes the Stems re-rate inside
    // the pipeline, so the click source is re-rated the same way; in basic
    // mode the activeSources playbackRate sweep above already covered it.
    if (
      this.playing &&
      this.clickSource !== null &&
      this.getStretchMode() !== "basic"
    ) {
      this.restartClickSource(
        this.audioContext.currentTime,
        this.currentOffset
      );
    }

    this.notifyTimeStretch();
  }

  public getPitch(): number {
    return this.pitch;
  }

  public setPitch(semitones: number): void {
    const clamped = Math.max(-12, Math.min(12, semitones));
    this.pitch = clamped;
    if (
      this.useWorklet &&
      this.stretchAdapter &&
      !this.stretchAdapter.isFallback
    ) {
      this.stretchAdapter.setPitch(clamped);
    } else if (this.useWorklet && this.workletNode) {
      this.workletNode.port.postMessage({ type: "setPitch", pitch: clamped });
    }
    this.notifyTimeStretch();
  }

  public isFormantPreservationEnabled(): boolean {
    return this.formantPreservation;
  }

  public setFormantPreservation(enabled: boolean): void {
    this.formantPreservation = enabled;
    if (
      this.useWorklet &&
      this.stretchAdapter &&
      !this.stretchAdapter.isFallback
    ) {
      this.stretchAdapter.setFormantPreservation(enabled);
    }
    this.notifyTimeStretch();
  }

  public resetTimeStretch(): void {
    this.setTempo(1.0);
    this.setPitch(0);
    if (
      this.useWorklet &&
      this.stretchAdapter &&
      !this.stretchAdapter.isFallback
    ) {
      this.stretchAdapter.setTempo(1.0);
      this.stretchAdapter.setPitch(0);
    } else if (this.useWorklet && this.workletNode) {
      this.workletNode.port.postMessage({ type: "resetTimeStretch" });
    }
  }

  public getTimeStretch(): TimeStretchState {
    return {
      tempo: this.tempo,
      pitch: this.pitch,
    };
  }

  public subscribeTimeStretch(listener: TimeStretchListener): () => void {
    this.timeStretchListeners.add(listener);
    listener(this.getTimeStretch());
    return () => {
      this.timeStretchListeners.delete(listener);
    };
  }

  private notifyTimeStretch(): void {
    const state = this.getTimeStretch();
    for (const listener of this.timeStretchListeners) {
      listener(state);
    }
    this.publish();
  }

  public isUsingWorklet(): boolean {
    return (
      this.useWorklet &&
      (this.workletNode !== null ||
        (this.stretchAdapter !== null && !this.stretchAdapter.isFallback))
    );
  }

  /**
   * Active time-stretch pipeline: 'signalsmith' (WASM formant-aware),
   * 'wsola' (in-process WSOLA worklet), or 'basic' (playbackRate last resort,
   * where pitch control is inert).
   */
  public getStretchMode(): "signalsmith" | "wsola" | "basic" {
    if (
      this.useWorklet &&
      this.stretchAdapter &&
      !this.stretchAdapter.isFallback
    ) {
      return "signalsmith";
    }
    if (this.useWorklet && this.workletNode) {
      return "wsola";
    }
    return "basic";
  }

  public getStretchAdapter(): MultiTrackStretchNode | null {
    return this.stretchAdapter;
  }

  public getActiveSources(): AudioBufferSourceNode[] {
    return [...this.activeSources];
  }

  public async waitForWorkletReady(): Promise<boolean> {
    if (this.workletInitPromise) {
      try {
        await this.workletInitPromise;
      } catch {
        // Ignored
      }
    }
    return this.isUsingWorklet();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.pause();
    this.stopPositionLoop();
    this.positionListeners.clear();
    this.stateListeners.clear();
    this.timeStretchListeners.clear();
    this.levelsListeners.clear();
    this.snapshotListeners.clear();

    for (const tapNode of [
      this.splitterNode,
      this.mergerNode,
      this.analyserL,
      this.analyserR,
    ]) {
      if (tapNode) {
        try {
          tapNode.disconnect();
        } catch {
          // Ignored
        }
      }
    }
    this.splitterNode = null;
    this.mergerNode = null;
    this.analyserL = null;
    this.analyserR = null;
    this.levelScratch = null;

    if (this.stretchAdapter) {
      try {
        this.stretchAdapter.disconnect();
      } catch {
        // Ignored
      }
      this.stretchAdapter = null;
    }

    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        // Ignored
      }
      this.workletNode = null;
    }

    for (const stem of STEM_NAMES) {
      try {
        this.stemGainNodes[stem].disconnect();
      } catch {
        // Node might already be disconnected
      }
    }

    // Click Track lane: released like a lane but never part of the Stem graph.
    this.stopClickSource();
    if (this.clickGainNode) {
      try {
        this.clickGainNode.disconnect();
      } catch {
        // Node might already be disconnected
      }
      this.clickGainNode = null;
    }
    this.clickBuffer = null;

    try {
      this.masterGainNode.disconnect();
    } catch {
      // Ignored
    }

    if (this.isOwnContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
  }
}
