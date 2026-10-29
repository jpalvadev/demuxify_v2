export interface WaveformPeaks {
  /**
   * Normalized minimum (negative / lower) peaks per bin, strictly clamped to [-1, 0]
   */
  min: Float32Array;

  /**
   * Normalized maximum (positive / upper) peaks per bin, strictly clamped to [0, 1]
   */
  max: Float32Array;

  /**
   * Total number of downsampled bins
   */
  length: number;
}

export interface ComputePeaksOptions {
  /**
   * Desired number of downsampled bins for rendering (defaults to 800)
   */
  targetBins?: number;
}

export interface AudioBufferLike {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  getChannelData: (channel: number) => Float32Array;
}

/**
 * Computes downsampled min/max peak envelopes from an AudioBuffer.
 * Handles both mono and multi-channel audio, merging channels into a unified peak envelope.
 */
export function computeWaveformPeaks(
  audioBuffer: AudioBufferLike,
  options?: ComputePeaksOptions
): WaveformPeaks {
  const totalSamples = audioBuffer.length;
  if (totalSamples === 0) {
    return {
      min: new Float32Array(0),
      max: new Float32Array(0),
      length: 0,
    };
  }

  const requestedBins = options?.targetBins ?? 800;
  const bins = Math.max(1, Math.min(requestedBins, totalSamples));

  const numChannels = audioBuffer.numberOfChannels;
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(audioBuffer.getChannelData(c));
  }

  const minPeaks = new Float32Array(bins);
  const maxPeaks = new Float32Array(bins);

  for (let b = 0; b < bins; b++) {
    const startSample = Math.floor((b * totalSamples) / bins);
    let endSample = Math.floor(((b + 1) * totalSamples) / bins);
    if (endSample <= startSample) {
      endSample = startSample + 1;
    }
    if (endSample > totalSamples) {
      endSample = totalSamples;
    }

    let min = 0;
    let max = 0;

    for (let i = startSample; i < endSample; i++) {
      for (let c = 0; c < numChannels; c++) {
        const val = channelData[c][i];
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }

    // Clamp peaks strictly between [-1, 1]
    minPeaks[b] = Math.max(-1, Math.min(0, min));
    maxPeaks[b] = Math.min(1, Math.max(0, max));
  }

  return {
    min: minPeaks,
    max: maxPeaks,
    length: bins,
  };
}
