/**
 * WSOLA (Waveform Similarity Overlap-Add) Time-Stretch & Pitch-Shifting Processor.
 *
 * Implements real-time time-scale modification (tempo: 0.5x to 2.0x) and pitch shifting
 * (-12 to +12 semitones or fractional cents) across 4 stereo Stems (8 audio channels total).
 * Preserves inter-stem phase synchronization by deriving overlap-add offsets from a unified
 * composite reference across all channels, preventing comb filtering.
 */

export interface WsolaOptions {
  channels?: number; // default 8
  windowSize?: number; // default 1024
  hopSize?: number; // default windowSize / 2
  searchRange?: number; // default windowSize / 4
  sampleRate?: number; // default 44100
}

export interface ProcessParams {
  tempo?: number; // 0.5 to 2.0, default 1.0
  pitch?: number; // -12 to 12, default 0
}

/**
 * Converts a musical pitch offset in semitones (-12 to +12) or fractional cents to a frequency/playback ratio.
 * Formula: ratio = 2 ^ (semitones / 12)
 */
export function semitonesToPitchRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/**
 * Converts a frequency ratio back to semitones.
 */
export function pitchRatioToSemitones(ratio: number): number {
  return 12 * Math.log2(ratio);
}

/**
 * Calculates the effective WSOLA time-stretch factor (alpha) required to achieve
 * the target tempo scaling and pitch shift.
 *
 * When pitch is shifted by ratio R = 2^(semitones/12) via resampling, duration is scaled by 1/R.
 * To achieve a target tempo T without altering duration due to pitch, WSOLA must stretch by:
 * alpha = T / R
 */
export function calculateEffectiveWsolaAlpha(tempo: number, pitchSemitones: number): number {
  const pitchRatio = semitonesToPitchRatio(pitchSemitones);
  return tempo / pitchRatio;
}

/**
 * Generates a periodic Hann window of given size.
 * w[k] = 0.5 * (1 - cos(2 * PI * k / size))
 * Satisfies the constant-overlap-add property (w[k] + w[k + size/2] = 1.0) with 50% overlap.
 */
export function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  const factor = (2 * Math.PI) / size;
  for (let k = 0; k < size; k++) {
    window[k] = 0.5 * (1 - Math.cos(factor * k));
  }
  return window;
}

/**
 * Linearly resamples an audio channel by a given playback ratio.
 * When ratio > 1.0, pitches up and shortens duration.
 * When ratio < 1.0, pitches down and lengthens duration.
 */
export function resampleChannel(channel: Float32Array, ratio: number): Float32Array {
  if (Math.abs(ratio - 1.0) < 1e-6) {
    return new Float32Array(channel);
  }

  const inLen = channel.length;
  const outLen = Math.floor(inLen / ratio);
  const out = new Float32Array(outLen);

  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;

    const v0 = channel[idx];
    const v1 = idx + 1 < inLen ? channel[idx + 1] : v0;
    out[i] = v0 + frac * (v1 - v0);
  }

  return out;
}

/**
 * Computes cross-correlation similarity between a reference segment and candidate segments
 * within a search range, returning the optimal offset delta that maximizes waveform similarity.
 */
export function findBestOffset(
  signal: Float32Array,
  refPos: number,
  targetPos: number,
  windowSize: number,
  searchRange: number
): number {
  let bestDelta = 0;
  let bestCorr = -Infinity;

  const sigLen = signal.length;

  for (let delta = -searchRange; delta <= searchRange; delta++) {
    const candPos = targetPos + delta;
    if (candPos < 0 || candPos + windowSize > sigLen) {
      continue;
    }

    let dot = 0;
    let normCand = 0;

    for (let k = 0; k < windowSize; k++) {
      const r = refPos + k < sigLen ? signal[refPos + k] : 0;
      const c = candPos + k < sigLen ? signal[candPos + k] : 0;
      dot += r * c;
      normCand += c * c;
    }

    // Normalized cross-correlation score
    const score = normCand > 1e-9 ? dot / Math.sqrt(normCand) : dot;

    if (score > bestCorr) {
      bestCorr = score;
      bestDelta = delta;
    }
  }

  return bestDelta;
}

/**
 * WsolaProcessor manages batch time-stretching and pitch shifting for multi-channel audio
 * (e.g. 4 stereo stems = 8 channels) while ensuring inter-channel phase synchronization.
 */
export class WsolaProcessor {
  private channels: number;
  private windowSize: number;
  private hopSize: number;
  private searchRange: number;
  private sampleRate: number;
  private window: Float32Array;

  private tempo: number = 1.0;
  private pitch: number = 0; // semitones (-12 to +12)

  constructor(options?: WsolaOptions) {
    this.channels = options?.channels ?? 8;
    this.windowSize = options?.windowSize ?? 1024;
    this.hopSize = options?.hopSize ?? Math.floor(this.windowSize / 2);
    this.searchRange = options?.searchRange ?? Math.floor(this.windowSize / 4);
    this.sampleRate = options?.sampleRate ?? 44100;

    this.window = createHannWindow(this.windowSize);
  }

  public getTempo(): number {
    return this.tempo;
  }

  public getChannels(): number {
    return this.channels;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public setTempo(tempo: number): void {
    this.tempo = Math.max(0.5, Math.min(2.0, tempo));
  }

  public getPitch(): number {
    return this.pitch;
  }

  public setPitch(semitones: number): void {
    this.pitch = Math.max(-12, Math.min(12, semitones));
  }

  public reset(): void {
    this.tempo = 1.0;
    this.pitch = 0;
  }

  /**
   * Process multiple audio channels with WSOLA time stretching and resampling.
   */
  public process(inputChannels: Float32Array[], params?: ProcessParams): Float32Array[] {
    const tempo = Math.max(0.5, Math.min(2.0, params?.tempo ?? this.tempo));
    const pitch = Math.max(-12, Math.min(12, params?.pitch ?? this.pitch));

    const numChannels = inputChannels.length;
    if (numChannels === 0) return [];
    const inLen = inputChannels[0].length;
    if (inLen === 0) return inputChannels.map(() => new Float32Array(0));

    // Passthrough optimization if no time or pitch alteration
    if (Math.abs(tempo - 1.0) < 1e-4 && Math.abs(pitch) < 1e-4) {
      return inputChannels.map((ch) => new Float32Array(ch));
    }

    const effectiveAlpha = calculateEffectiveWsolaAlpha(tempo, pitch);
    const pitchRatio = semitonesToPitchRatio(pitch);

    // Build mono composite reference across all channels to find unified optimal offsets
    const composite = new Float32Array(inLen);
    for (let c = 0; c < numChannels; c++) {
      const ch = inputChannels[c];
      for (let i = 0; i < inLen; i++) {
        composite[i] += ch[i] / numChannels;
      }
    }

    const Sa = this.hopSize * effectiveAlpha;
    const Ss = this.hopSize;
    const N = this.windowSize;

    const outLenWsola = Math.max(N, Math.floor(inLen / effectiveAlpha));
    const numFrames = Math.ceil((outLenWsola - N) / Ss) + 1;

    const wsolaOut: Float32Array[] = Array.from(
      { length: numChannels },
      () => new Float32Array(outLenWsola)
    );

    let prevChosenPos = 0;

    for (let m = 0; m < numFrames; m++) {
      const targetPos = Math.round(m * Sa);
      let chosenPos = targetPos;

      if (m === 0) {
        chosenPos = 0;
      } else {
        const refPos = prevChosenPos + Ss;
        const delta = findBestOffset(composite, refPos, targetPos, N, this.searchRange);
        chosenPos = Math.max(0, Math.min(inLen - N, targetPos + delta));
      }

      prevChosenPos = chosenPos;

      const outOffset = m * Ss;
      for (let c = 0; c < numChannels; c++) {
        const inCh = inputChannels[c];
        const outCh = wsolaOut[c];

        for (let k = 0; k < N; k++) {
          if (outOffset + k < outLenWsola) {
            const inSample = chosenPos + k < inLen ? inCh[chosenPos + k] : 0;
            outCh[outOffset + k] += inSample * this.window[k];
          }
        }
      }
    }

    // Apply pitch shifting via resampling if pitch != 0
    if (Math.abs(pitchRatio - 1.0) > 1e-4) {
      return wsolaOut.map((ch) => resampleChannel(ch, pitchRatio));
    }

    return wsolaOut;
  }
}

export const WSOLA_WORKLET_PROCESSOR_NAME = 'wsola-multitrack-processor';

/**
 * Standalone AudioWorklet processor implementation code that executes in AudioWorkletGlobalScope.
 * Implements real-time streaming WSOLA time-stretching (0.5x-2.0x) and pitch transposition (-12 to +12 st)
 * across 4 stereo Stems (8 audio channels) with phase-locked multi-channel coherence.
 */
export const WSOLA_WORKLET_SOURCE = `
function findBestOffset(signal, inLen, refPos, targetPos, windowSize, searchRange) {
  let bestDelta = 0;
  let bestCorr = -Infinity;

  for (let delta = -searchRange; delta <= searchRange; delta++) {
    const candPos = targetPos + delta;
    if (candPos < 0 || candPos + windowSize > inLen) continue;
    let dot = 0;
    let norm = 0;
    for (let k = 0; k < windowSize; k++) {
      const r = (refPos + k < inLen) ? signal[refPos + k] : 0;
      const c = signal[candPos + k];
      dot += r * c;
      norm += c * c;
    }
    const score = norm > 1e-9 ? dot / Math.sqrt(norm) : dot;
    if (score > bestCorr) {
      bestCorr = score;
      bestDelta = delta;
    }
  }
  return bestDelta;
}

class WsolaMultitrackProcessor extends (typeof AudioWorkletProcessor !== 'undefined' ? AudioWorkletProcessor : Object) {
  constructor() {
    super();
    this.stems = []; // 8 Float32Arrays: [vL, vR, dL, dR, bL, bR, oL, oR]
    this.composite = null;
    this.playing = false;
    this.tempo = 1.0;
    this.pitch = 0;
    this.readPos = 0; // Current position in source audio (samples)
    this.sampleRate = 44100;
    this.quantumCounter = 0;

    // WSOLA parameters (N = 512, Ss = 256, searchRange = 128)
    this.N = 512;
    this.Ss = 256;
    this.searchRange = 128;
    this.window = new Float32Array(this.N);
    for (let k = 0; k < this.N; k++) {
      this.window[k] = 0.5 * (1 - Math.cos((2 * Math.PI * k) / this.N));
    }

    // Overlap-add accumulator buffers (8 channels x 512 samples)
    this.acc = Array.from({ length: 8 }, () => new Float32Array(this.N));

    // Intermediate resample buffer (8 channels x 4096 capacity)
    this.resampleCapacity = 4096;
    this.resampleBuf = Array.from({ length: 8 }, () => new Float32Array(this.resampleCapacity));
    this.resampleBufLen = 0;
    this.resamplePos = 0;

    // Output ring buffer (8 channels x 16384 capacity)
    this.ringCapacity = 16384;
    this.outRing = Array.from({ length: 8 }, () => new Float32Array(this.ringCapacity));
    this.ringWritePos = 0;
    this.ringReadPos = 0;
    this.bufferedCount = 0;

    // Synthesis tracking
    this.inputPos = 0;
    this.prevChosenPos = 0;

    if (!this.port) {
      this.port = { postMessage: () => {} };
    }

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      switch (data.type) {
        case 'loadStems': {
          this.stems = data.stems || [];
          this.sampleRate = data.sampleRate || 44100;
          this.readPos = 0;
          this.inputPos = 0;
          this.prevChosenPos = 0;
          this.resetBuffers();

          if (this.stems.length >= 8 && this.stems[0]) {
            const maxLen = this.stems[0].length;
            this.composite = new Float32Array(maxLen);
            const numCh = this.stems.length;
            for (let c = 0; c < numCh; c++) {
              const ch = this.stems[c];
              for (let i = 0; i < maxLen; i++) {
                this.composite[i] += ch[i] / numCh;
              }
            }
          }
          break;
        }
        case 'setTempo': {
          const newTempo = Math.max(0.5, Math.min(2.0, Number(data.tempo) || 1.0));
          if (Math.abs(newTempo - this.tempo) > 1e-4) {
            this.tempo = newTempo;
            this.resetBuffers();
            this.inputPos = Math.round(this.readPos);
            this.prevChosenPos = this.inputPos;
          }
          break;
        }
        case 'setPitch': {
          const newPitch = Math.max(-12, Math.min(12, Number(data.pitch) || 0));
          if (Math.abs(newPitch - this.pitch) > 1e-4) {
            this.pitch = newPitch;
            this.resetBuffers();
            this.inputPos = Math.round(this.readPos);
            this.prevChosenPos = this.inputPos;
          }
          break;
        }
        case 'resetTimeStretch': {
          this.tempo = 1.0;
          this.pitch = 0;
          this.resetBuffers();
          this.inputPos = Math.round(this.readPos);
          this.prevChosenPos = this.inputPos;
          break;
        }
        case 'play': {
          this.playing = true;
          break;
        }
        case 'pause': {
          this.playing = false;
          break;
        }
        case 'seek': {
          this.readPos = Math.max(0, (Number(data.timeSec) || 0) * this.sampleRate);
          this.inputPos = Math.round(this.readPos);
          this.prevChosenPos = this.inputPos;
          this.resetBuffers();
          break;
        }
      }
    };
  }

  resetBuffers() {
    this.bufferedCount = 0;
    this.ringWritePos = 0;
    this.ringReadPos = 0;
    this.resampleBufLen = 0;
    this.resamplePos = 0;

    if (this.stems && this.stems.length >= 8 && this.stems[0]) {
      const maxStemLen = this.stems[0].length;
      const startPos = Math.max(0, Math.min(maxStemLen - this.N, Math.round(this.inputPos)));
      for (let c = 0; c < 8; c++) {
        const inCh = this.stems[c];
        const accCh = this.acc[c];
        for (let k = 0; k < this.N; k++) {
          const s = (startPos + k < maxStemLen) ? inCh[startPos + k] : 0;
          accCh[k] = s * this.window[k];
        }
      }
    } else {
      for (let c = 0; c < 8; c++) {
        this.acc[c].fill(0);
      }
    }
  }

  synthesizeFrames(minSamples) {
    if (!this.stems || this.stems.length < 8 || !this.composite) return;
    const maxStemLen = this.stems[0].length;
    const pitchRatio = Math.pow(2, this.pitch / 12);
    const alpha = this.tempo / pitchRatio;
    const Sa = this.Ss * alpha;

    while (this.bufferedCount < minSamples && this.inputPos < maxStemLen) {
      const targetPos = Math.round(this.inputPos + Sa);
      if (targetPos >= maxStemLen) break;

      const refPos = this.prevChosenPos + this.Ss;
      const bestDelta = findBestOffset(this.composite, maxStemLen, refPos, targetPos, this.N, this.searchRange);
      const chosenPos = Math.max(0, Math.min(maxStemLen - this.N, targetPos + bestDelta));
      this.prevChosenPos = chosenPos;
      this.inputPos = targetPos;

      // Overlap-add windowed segment across all 8 channels with shared chosenPos (preserving phase)
      for (let c = 0; c < 8; c++) {
        const inCh = this.stems[c];
        const accCh = this.acc[c];
        for (let k = 0; k < this.N; k++) {
          const s = (chosenPos + k < maxStemLen) ? inCh[chosenPos + k] : 0;
          accCh[k] += s * this.window[k];
        }
      }

      // First Ss samples of acc are ready -> copy to resampleBuf
      if (this.resampleBufLen + this.Ss <= this.resampleCapacity) {
        for (let c = 0; c < 8; c++) {
          for (let k = 0; k < this.Ss; k++) {
            this.resampleBuf[c][this.resampleBufLen + k] = this.acc[c][k];
          }
        }
        this.resampleBufLen += this.Ss;
      }

      // Shift acc by Ss
      for (let c = 0; c < 8; c++) {
        const accCh = this.acc[c];
        for (let k = 0; k < this.N - this.Ss; k++) {
          accCh[k] = accCh[k + this.Ss];
        }
        for (let k = this.N - this.Ss; k < this.N; k++) {
          accCh[k] = 0;
        }
      }

      // Resample from resampleBuf into outRing
      let written = 0;
      while (this.resamplePos + 1 < this.resampleBufLen && this.bufferedCount + written < this.ringCapacity) {
        const idx = Math.floor(this.resamplePos);
        const frac = this.resamplePos - idx;
        const dstIdx = (this.ringWritePos + written) % this.ringCapacity;
        for (let c = 0; c < 8; c++) {
          const s0 = this.resampleBuf[c][idx];
          const s1 = this.resampleBuf[c][idx + 1];
          this.outRing[c][dstIdx] = s0 + frac * (s1 - s0);
        }
        written++;
        this.resamplePos += pitchRatio;
      }

      if (this.resamplePos >= 1) {
        const consumed = Math.floor(this.resamplePos);
        const remaining = this.resampleBufLen - consumed;
        for (let c = 0; c < 8; c++) {
          this.resampleBuf[c].copyWithin(0, consumed, this.resampleBufLen);
        }
        this.resampleBufLen = remaining;
        this.resamplePos -= consumed;
      }

      this.ringWritePos = (this.ringWritePos + written) % this.ringCapacity;
      this.bufferedCount += written;
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.playing || this.stems.length < 8) {
      return true;
    }

    const maxStemLen = this.stems[0].length;
    if (this.readPos >= maxStemLen) {
      this.playing = false;
      this.port.postMessage({ type: 'ended' });
      return true;
    }

    const quantumLength = outputs[0] && outputs[0][0] ? outputs[0][0].length : 128;

    if (this.bufferedCount < 1024) {
      this.synthesizeFrames(2048);
    }

    const toWrite = Math.min(quantumLength, this.bufferedCount);

    for (let s = 0; s < 4; s++) {
      const outStem = outputs[s];
      if (!outStem) continue;
      const leftCh = s * 2;
      const rightCh = s * 2 + 1;

      for (let i = 0; i < toWrite; i++) {
        const srcIdx = (this.ringReadPos + i) % this.ringCapacity;
        if (outStem[0]) outStem[0][i] = this.outRing[leftCh][srcIdx];
        if (outStem[1]) outStem[1][i] = this.outRing[rightCh][srcIdx];
      }
      for (let i = toWrite; i < quantumLength; i++) {
        if (outStem[0]) outStem[0][i] = 0;
        if (outStem[1]) outStem[1][i] = 0;
      }
    }

    this.ringReadPos = (this.ringReadPos + toWrite) % this.ringCapacity;
    this.bufferedCount -= toWrite;
    this.readPos += toWrite * this.tempo;

    if (this.readPos >= maxStemLen || (toWrite === 0 && this.inputPos >= maxStemLen)) {
      this.playing = false;
      this.port.postMessage({ type: 'ended' });
    }

    this.quantumCounter++;
    if (this.quantumCounter % 32 === 0) {
      this.port.postMessage({
        type: 'position',
        timeSec: this.readPos / this.sampleRate,
      });
    }

    return true;
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor('${WSOLA_WORKLET_PROCESSOR_NAME}', WsolaMultitrackProcessor);
}
`;

// Export class directly for unit testing and direct inspection
export const WsolaMultitrackProcessor = new Function(`
  ${WSOLA_WORKLET_SOURCE}
  return WsolaMultitrackProcessor;
`)();

/**
 * Registers the WSOLA AudioWorklet processor module in the given AudioContext.
 * Returns true if registration succeeded, or false if unsupported/failed.
 */
export async function registerWsolaAudioWorklet(audioContext: AudioContext): Promise<boolean> {
  if (
    !audioContext ||
    !audioContext.audioWorklet ||
    typeof audioContext.audioWorklet.addModule !== 'function'
  ) {
    return false;
  }

  try {
    let url: string;
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([WSOLA_WORKLET_SOURCE], { type: 'application/javascript' });
      url = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
    } else if (typeof btoa === 'function') {
      url = 'data:application/javascript;base64,' + btoa(WSOLA_WORKLET_SOURCE);
      await audioContext.audioWorklet.addModule(url);
    } else {
      return false;
    }
    return true;
  } catch (err) {
    // If addModule fails (e.g. security policy or unsupported environment), gracefully fail
    return false;
  }
}
