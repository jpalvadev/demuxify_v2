import { StemName, STEM_NAMES } from "./chunkOverlapAdd";

export interface StretchNodeInterface {
  schedule: (params: {
    output?: number;
    active?: boolean;
    input?: number;
    rate?: number;
    semitones?: number;
    formantCompensation?: boolean;
    formantBaseHz?: number;
    loopStart?: number;
    loopEnd?: number;
  }) => Promise<any> | void;
  start: (
    when?: number,
    offset?: number,
    duration?: number
  ) => Promise<any> | void;
  stop: (when?: number) => Promise<any> | void;
  addBuffers: (buffers: Float32Array[]) => Promise<number>;
  dropBuffers: (toSeconds?: number) => Promise<any>;
  connect: (
    destinationNode: AudioNode,
    output?: number,
    input?: number
  ) => AudioNode;
  disconnect: () => void;
  inputTime?: number;
  setUpdateInterval?: (
    seconds: number,
    callback?: (time: number) => void
  ) => Promise<any>;
}

export interface MultiTrackStretchOptions {
  audioContext: AudioContext | OfflineAudioContext;
  sampleRate?: number;
  initialTempo?: number; // rate (0.50 to 2.00)
  initialPitch?: number; // semitones (-12 to +12)
  formantPreservation?: boolean; // vocal formant compensation toggle, default true
  forceFallback?: boolean;
  customFactory?: (
    ctx: AudioContext | OfflineAudioContext,
    stem: StemName
  ) => Promise<StretchNodeInterface>;
}

export interface MultiTrackStretchNode {
  readonly isFallback: boolean;
  getStemNode: (stem: StemName) => AudioNode | StretchNodeInterface | null;
  loadStems: (
    stems: Record<StemName, Float32Array[] | AudioBuffer>
  ) => Promise<void>;
  setTempo: (rate: number) => void;
  setPitch: (semitones: number) => void;
  setFormantPreservation: (enabled: boolean) => void;
  start: (when?: number, offset?: number) => void;
  stop: (when?: number) => void;
  seek: (timeSec: number) => void;
  connectStem: (stem: StemName, destination: AudioNode) => void;
  disconnect: () => void;
  getTempo: () => number;
  getPitch: () => number;
  isFormantPreservationEnabled: () => boolean;
}

/**
 * Checks whether the current execution environment supports Signalsmith Stretch WebAssembly
 * and AudioWorklet processing.
 */
export function isSignalsmithStretchSupported(
  audioContext?: AudioContext | OfflineAudioContext
): boolean {
  if (typeof window === "undefined" && typeof globalThis === "undefined") {
    return false;
  }
  if (typeof WebAssembly === "undefined") {
    return false;
  }
  if (!audioContext) {
    return false;
  }
  if (
    !audioContext.audioWorklet ||
    typeof audioContext.audioWorklet.addModule !== "function"
  ) {
    return false;
  }
  // Allow explicit enablement on test doubles
  if ((audioContext as any).__enableSignalsmith) {
    return true;
  }
  const WorkletNode =
    (typeof window !== "undefined" ? (window as any).AudioWorkletNode : null) ||
    (typeof globalThis !== "undefined"
      ? (globalThis as any).AudioWorkletNode
      : null);
  if (!WorkletNode || typeof WorkletNode !== "function") {
    return false;
  }
  // Check if AudioWorkletNode is native
  return WorkletNode.toString().includes("[native code]");
}

function extractChannels(
  bufferOrChannels: Float32Array[] | AudioBuffer
): Float32Array[] {
  if (Array.isArray(bufferOrChannels)) {
    return bufferOrChannels;
  }
  const numChannels = bufferOrChannels.numberOfChannels;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(bufferOrChannels.getChannelData(c));
  }
  return channels;
}

/**
 * Creates a mock/fallback multi-track adapter for headless test environments (Vitest/JSDOM)
 * or browsers lacking AudioWorklet/WASM support.
 */
class FallbackMultiTrackStretchAdapter implements MultiTrackStretchNode {
  public readonly isFallback = true;
  private audioContext: AudioContext | OfflineAudioContext;
  private tempo: number;
  private pitch: number;
  private formantPreservation: boolean;
  private stemGainNodes: Record<StemName, GainNode>;
  private stemBuffers: Record<StemName, Float32Array[] | null>;
  private activeSources: Record<StemName, AudioBufferSourceNode | null>;

  constructor(options: MultiTrackStretchOptions) {
    this.audioContext = options.audioContext;
    this.tempo = options.initialTempo ?? 1.0;
    this.pitch = options.initialPitch ?? 0;
    this.formantPreservation = options.formantPreservation ?? true;

    this.stemGainNodes = {
      vocals: this.audioContext.createGain(),
      drums: this.audioContext.createGain(),
      bass: this.audioContext.createGain(),
      other: this.audioContext.createGain(),
    };

    this.stemBuffers = {
      vocals: null,
      drums: null,
      bass: null,
      other: null,
    };

    this.activeSources = {
      vocals: null,
      drums: null,
      bass: null,
      other: null,
    };
  }

  public getStemNode(stem: StemName): AudioNode {
    return this.stemGainNodes[stem];
  }

  public async loadStems(
    stems: Record<StemName, Float32Array[] | AudioBuffer>
  ): Promise<void> {
    for (const stem of STEM_NAMES) {
      if (stems[stem]) {
        this.stemBuffers[stem] = extractChannels(stems[stem]);
      }
    }
  }

  public setTempo(rate: number): void {
    this.tempo = rate;
    for (const stem of STEM_NAMES) {
      const src = this.activeSources[stem];
      if (src && src.playbackRate) {
        src.playbackRate.value = rate;
      }
    }
  }

  public setPitch(semitones: number): void {
    this.pitch = semitones;
  }

  public setFormantPreservation(enabled: boolean): void {
    this.formantPreservation = enabled;
  }

  public start(when: number = 0, offset: number = 0): void {
    this.stop();
    for (const stem of STEM_NAMES) {
      const channels = this.stemBuffers[stem];
      if (!channels || channels.length === 0) continue;

      const buffer = this.audioContext.createBuffer(
        channels.length,
        channels[0].length,
        this.audioContext.sampleRate
      );
      for (let c = 0; c < channels.length; c++) {
        buffer.getChannelData(c).set(channels[c]);
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = this.tempo;
      source.connect(this.stemGainNodes[stem]);
      source.start(when, offset);
      this.activeSources[stem] = source;
    }
  }

  public stop(when: number = 0): void {
    for (const stem of STEM_NAMES) {
      const src = this.activeSources[stem];
      if (src) {
        try {
          src.stop(when);
          src.disconnect();
        } catch {
          // ignore already stopped sources
        }
        this.activeSources[stem] = null;
      }
    }
  }

  public seek(timeSec: number): void {
    // If running, restart from seek time
    const anyActive = Object.values(this.activeSources).some((s) => s !== null);
    if (anyActive) {
      this.start(this.audioContext.currentTime, timeSec);
    }
  }

  public connectStem(stem: StemName, destination: AudioNode): void {
    this.stemGainNodes[stem].connect(destination);
  }

  public disconnect(): void {
    this.stop();
    for (const stem of STEM_NAMES) {
      this.stemGainNodes[stem].disconnect();
    }
  }

  public getTempo(): number {
    return this.tempo;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public isFormantPreservationEnabled(): boolean {
    return this.formantPreservation;
  }
}

/**
 * Signalsmith Stretch WebAssembly MultiTrack Adapter.
 * Manages 4 synchronized stereo nodes, applying formant preservation exclusively to Vocals.
 */
class WasmMultiTrackStretchAdapter implements MultiTrackStretchNode {
  public readonly isFallback = false;
  public readonly audioContext: AudioContext | OfflineAudioContext;
  private tempo: number;
  private pitch: number;
  private formantPreservation: boolean;
  private stemNodes: Record<StemName, StretchNodeInterface>;

  constructor(
    audioContext: AudioContext | OfflineAudioContext,
    stemNodes: Record<StemName, StretchNodeInterface>,
    options?: MultiTrackStretchOptions
  ) {
    this.audioContext = audioContext;
    this.stemNodes = stemNodes;
    this.tempo = options?.initialTempo ?? 1.0;
    this.pitch = options?.initialPitch ?? 0;
    this.formantPreservation = options?.formantPreservation ?? true;

    this.dispatchAllSchedules();
  }

  public getStemNode(stem: StemName): StretchNodeInterface {
    return this.stemNodes[stem];
  }

  public async loadStems(
    stems: Record<StemName, Float32Array[] | AudioBuffer>
  ): Promise<void> {
    const promises: Promise<any>[] = [];
    for (const stem of STEM_NAMES) {
      const data = stems[stem];
      if (data) {
        const channels = extractChannels(data);
        const node = this.stemNodes[stem];
        promises.push(
          Promise.resolve(node.dropBuffers()).then(() =>
            node.addBuffers(channels)
          )
        );
      }
    }
    await Promise.all(promises);
  }

  public setTempo(rate: number): void {
    this.tempo = rate;
    this.dispatchAllSchedules();
  }

  public setPitch(semitones: number): void {
    this.pitch = semitones;
    this.dispatchAllSchedules();
  }

  public setFormantPreservation(enabled: boolean): void {
    this.formantPreservation = enabled;
    this.dispatchAllSchedules();
  }

  private dispatchAllSchedules(): void {
    for (const stem of STEM_NAMES) {
      const node = this.stemNodes[stem];
      if (!node) continue;

      // Vocal Formant Preservation Rule:
      // Formant preservation is enabled exclusively on the Vocals stem.
      // Drums, Bass, and Other always run with formantCompensation = false to preserve sharp transient attacks.
      const isVocals = stem === "vocals";
      const formantCompensation = isVocals && this.formantPreservation;

      node.schedule({
        rate: this.tempo,
        semitones: this.pitch,
        formantCompensation,
      });
    }
  }

  public start(when: number = 0, offset: number = 0): void {
    for (const stem of STEM_NAMES) {
      this.stemNodes[stem].start(when, offset);
    }
  }

  public stop(when: number = 0): void {
    for (const stem of STEM_NAMES) {
      this.stemNodes[stem].stop(when);
    }
  }

  public seek(timeSec: number): void {
    for (const stem of STEM_NAMES) {
      this.stemNodes[stem].schedule({ input: timeSec });
    }
  }

  public connectStem(stem: StemName, destination: AudioNode): void {
    (this.stemNodes[stem] as any).connect(destination);
  }

  public disconnect(): void {
    for (const stem of STEM_NAMES) {
      this.stemNodes[stem].disconnect();
    }
  }

  public getTempo(): number {
    return this.tempo;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public isFormantPreservationEnabled(): boolean {
    return this.formantPreservation;
  }
}

/**
 * Factory function to instantiate a 4-stem multi-track Signalsmith Stretch processor.
 * Gracefully falls back to test double in unsupported or headless environments.
 */
export async function createMultiTrackStretchAdapter(
  options: MultiTrackStretchOptions
): Promise<MultiTrackStretchNode> {
  if (
    options.forceFallback ||
    (!options.customFactory &&
      !isSignalsmithStretchSupported(options.audioContext))
  ) {
    return new FallbackMultiTrackStretchAdapter(options);
  }

  try {
    let factory = options.customFactory;
    if (!factory) {
      // Dynamic import of official signalsmith-stretch WebAssembly package
      const module = await import("signalsmith-stretch");
      const SignalsmithStretch = (module.default || module) as (
        ctx: AudioContext | OfflineAudioContext,
        opts?: any
      ) => Promise<StretchNodeInterface>;

      factory = async (ctx) => {
        return SignalsmithStretch(ctx, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });
      };
    }

    const stemNodes: Partial<Record<StemName, StretchNodeInterface>> = {};
    for (const stem of STEM_NAMES) {
      stemNodes[stem] = await factory(options.audioContext, stem);
    }

    return new WasmMultiTrackStretchAdapter(
      options.audioContext,
      stemNodes as Record<StemName, StretchNodeInterface>,
      options
    );
  } catch {
    // If native WASM worklet initialization failed, return fallback adapter
    return new FallbackMultiTrackStretchAdapter(options);
  }
}

export interface OfflineStretchOptions {
  sampleRate?: number;
  tempo?: number;
  pitch?: number;
  formantPreservation?: boolean;
}

/**
 * Renders stems offline with the active tempo and pitch settings applied.
 * Uses Signalsmith Stretch WebAssembly in supported offline environments,
 * or sample-accurate offline transformation in headless test environments.
 */
export async function renderOfflineStems(
  stems: Record<StemName, Float32Array[] | AudioBuffer>,
  options: OfflineStretchOptions = {}
): Promise<Record<StemName, Float32Array[]>> {
  const tempo = options.tempo ?? 1.0;
  const pitch = options.pitch ?? 0;
  const sampleRate = options.sampleRate ?? 44100;

  const result: Record<StemName, Float32Array[]> = {
    vocals: [],
    drums: [],
    bass: [],
    other: [],
  };

  const isNeutral = Math.abs(tempo - 1.0) < 1e-4 && Math.abs(pitch) < 1e-4;

  const OfflineCtxClass =
    typeof OfflineAudioContext !== "undefined"
      ? OfflineAudioContext
      : (globalThis as any).OfflineAudioContext;
  const isOfflineWasmSupported =
    Boolean(OfflineCtxClass) &&
    isSignalsmithStretchSupported(new OfflineCtxClass(2, 128, sampleRate));

  for (const stem of STEM_NAMES) {
    const raw = stems[stem];
    if (!raw) continue;
    const channels = extractChannels(raw);

    if (isNeutral || channels.length === 0 || channels[0].length === 0) {
      result[stem] = channels;
      continue;
    }

    let rendered: Float32Array[] | null = null;
    const inLength = channels[0].length;
    const targetLength = Math.max(1, Math.round(inLength / tempo));

    if (isOfflineWasmSupported && OfflineCtxClass) {
      try {
        const offlineCtx = new OfflineCtxClass(
          channels.length,
          targetLength,
          sampleRate
        );
        const module = await import("signalsmith-stretch");
        const SignalsmithStretch = (module.default || module) as any;
        const stretchNode = await SignalsmithStretch(offlineCtx, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [channels.length],
        });

        await stretchNode.addBuffers(channels);
        const isVocals = stem === "vocals";
        await stretchNode.schedule({
          rate: tempo,
          semitones: pitch,
          formantCompensation:
            isVocals && (options.formantPreservation ?? true),
        });
        stretchNode.start(0, 0);
        stretchNode.connect(offlineCtx.destination);

        const renderedBuffer = await offlineCtx.startRendering();
        rendered = [];
        for (let c = 0; c < renderedBuffer.numberOfChannels; c++) {
          rendered.push(renderedBuffer.getChannelData(c));
        }
      } catch {
        rendered = null;
      }
    }

    // Fallback: deterministic offline transform for test/mock environments
    if (!rendered) {
      const pitchRatio = Math.pow(2, pitch / 12);
      rendered = channels.map((ch) => {
        const len = ch.length;
        const outLen = Math.max(1, Math.round(len / tempo));
        const out = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const pos = (i * tempo * pitchRatio) % len;
          const idx = Math.floor(pos);
          const frac = pos - idx;
          const v0 = ch[idx] ?? 0;
          const v1 = idx + 1 < len ? ch[idx + 1] : v0;
          out[i] = v0 + frac * (v1 - v0);
        }
        return out;
      });
    }

    result[stem] = rendered;
  }

  return result;
}
