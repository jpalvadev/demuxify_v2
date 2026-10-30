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
  if (typeof window === "undefined" || typeof WebAssembly === "undefined") {
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
  // In synthetic Node/Vitest test environments where AudioWorkletNode is a custom spy double,
  // native WASM worklets are not available unless explicitly enabled.
  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV === "test" &&
    !(audioContext as any).__enableSignalsmith
  ) {
    return false;
  }
  return true;
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
      const nodePromise = factory(options.audioContext, stem);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("SignalsmithStretch initialization timeout")),
          150
        )
      );
      stemNodes[stem] = await Promise.race([nodePromise, timeoutPromise]);
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
