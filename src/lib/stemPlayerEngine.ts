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
}

export type PositionListener = (timeSec: number) => void;
export type StateListener = (state: StemMixerStates) => void;
export type TimeStretchListener = (state: TimeStretchState) => void;

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

  private tempo: number = 1.0;
  private pitch: number = 0; // semitones (-12 to +12)
  private formantPreservation: boolean = true;
  private stretchAdapter: MultiTrackStretchNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private useWorklet: boolean = false;
  private workletInitPromise: Promise<void> | null = null;
  private isDisposed: boolean = false;

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

    // Build Master Gain Node
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);

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

    if (options?.stretchAdapter) {
      this.stretchAdapter = options.stretchAdapter;
      this.useWorklet = !options.stretchAdapter.isFallback;
    } else if (!options?.disableWorklet) {
      this.workletInitPromise = this.initAudioWorklet(sampleRate);
    }
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

          if (this.playing) {
            const curTime = this.getCurrentTime();
            this.stopActiveSources();
            this.stretchAdapter.seek(curTime);
            this.stretchAdapter.start(this.audioContext.currentTime, curTime);
            this.playStartContextTime = this.audioContext.currentTime;
            this.currentOffset = curTime;
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

      // If active playback was started via fallback sources while worklet was loading,
      // seamlessly migrate active playback into the worklet without ghost sources!
      if (this.playing) {
        const curTime = this.getCurrentTime();
        this.stopActiveSources();
        this.workletNode.port.postMessage({ type: "seek", timeSec: curTime });
        this.workletNode.port.postMessage({ type: "play" });
        this.playStartContextTime = this.audioContext.currentTime;
        this.currentOffset = curTime;
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
  }

  public setStemVolume(stem: StemName, volume: number): void {
    this.stemStates[stem].volume = Math.max(0, Math.min(1, volume));
    this.applyGainMatrix();
    this.notifyState();
  }

  public setStemMute(stem: StemName, muted: boolean): void {
    this.stemStates[stem].muted = muted;
    this.applyGainMatrix();
    this.notifyState();
  }

  public toggleStemMute(stem: StemName): void {
    this.setStemMute(stem, !this.stemStates[stem].muted);
  }

  public setStemSolo(stem: StemName, solo: boolean): void {
    this.stemStates[stem].solo = solo;
    this.applyGainMatrix();
    this.notifyState();
  }

  public toggleStemSolo(stem: StemName): void {
    this.setStemSolo(stem, !this.stemStates[stem].solo);
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

  private notifyPosition(): void {
    const curTime = this.getCurrentTime();
    for (const listener of this.positionListeners) {
      listener(curTime);
    }
  }

  private notifyState(): void {
    const states = this.getAllStemStates();
    for (const listener of this.stateListeners) {
      listener(states);
    }
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
