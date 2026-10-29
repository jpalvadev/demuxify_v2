/**
 * Chunk segmentation and overlap-add blending module for Demucs audio separation.
 *
 * Implements smooth windowing across sequential Chunk Segments to prevent
 * boundary artifacts and reconstructs 4 discrete isolated Stems.
 */

export type StemName = "vocals" | "drums" | "bass" | "other";
export const STEM_NAMES: StemName[] = ["vocals", "drums", "bass", "other"];

export interface ChunkOptions {
  /** Chunk length in samples. Default: 343980 (~7.8s at 44.1kHz) */
  chunkSamples?: number;
  /** Overlap length between adjacent chunks in samples. Default: 44100 (1.0s at 44.1kHz) */
  overlapSamples?: number;
}

export interface ChunkSegment {
  chunkIndex: number;
  totalChunks: number;
  startSample: number;
  validSamples: number;
  /** Multi-channel Float32Array sliced and padded to chunkSamples */
  audio: Float32Array[];
}

export interface ChunkInferenceResult {
  chunkIndex: number;
  startSample: number;
  validSamples: number;
  stems: Record<StemName, Float32Array[]>;
}

export const DEFAULT_CHUNK_SAMPLES = 352800; // 8.0s @ 44.1kHz (T=801 frames for BS-RoFormer)
export const DEFAULT_OVERLAP_SAMPLES = 88200; // 2.0s @ 44.1kHz (25% overlap)

/**
 * Slices multi-channel audio into sequential Chunk Segments with overlap.
 */
export function createChunkSegments(
  channels: Float32Array[],
  options: ChunkOptions = {}
): ChunkSegment[] {
  const numChannels = channels.length;
  if (numChannels === 0) return [];
  const totalSamples = channels[0].length;
  if (totalSamples === 0) return [];

  const chunkSamples = options.chunkSamples ?? DEFAULT_CHUNK_SAMPLES;
  const overlapSamples = Math.min(
    options.overlapSamples ?? DEFAULT_OVERLAP_SAMPLES,
    Math.floor(chunkSamples / 2)
  );
  const step = Math.max(1, chunkSamples - overlapSamples);

  // Calculate starts
  const starts: number[] = [];
  if (totalSamples <= chunkSamples) {
    starts.push(0);
  } else {
    let currentStart = 0;
    while (currentStart < totalSamples) {
      starts.push(currentStart);
      if (currentStart + chunkSamples >= totalSamples) {
        break;
      }
      currentStart += step;
    }
  }

  const totalChunks = starts.length;
  const segments: ChunkSegment[] = [];

  for (let idx = 0; idx < totalChunks; idx++) {
    const startSample = starts[idx];
    const validSamples = Math.min(chunkSamples, totalSamples - startSample);

    const chunkAudio: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      const paddedBuffer = new Float32Array(chunkSamples);
      paddedBuffer.set(
        channels[c].subarray(startSample, startSample + validSamples)
      );
      chunkAudio.push(paddedBuffer);
    }

    segments.push({
      chunkIndex: idx,
      totalChunks,
      startSample,
      validSamples,
      audio: chunkAudio,
    });
  }

  return segments;
}

/**
 * Creates a Hann-tapered window function of length N with specified overlap margins.
 */
function createChunkWindow(
  length: number,
  overlap: number,
  isFirst: boolean,
  isLast: boolean
): Float32Array {
  const window = new Float32Array(length);
  window.fill(1.0);

  if (overlap <= 0) {
    return window;
  }

  // Fade in on left boundary if not first chunk
  if (!isFirst && overlap > 0) {
    for (let i = 0; i < overlap; i++) {
      // Hann fade-in
      window[i] = 0.5 * (1 - Math.cos((Math.PI * i) / overlap));
    }
  }

  // Fade out on right boundary if not last chunk
  if (!isLast && overlap > 0) {
    const fadeStart = length - overlap;
    for (let i = 0; i < overlap; i++) {
      // Hann fade-out
      window[fadeStart + i] = 0.5 * (1 + Math.cos((Math.PI * i) / overlap));
    }
  }

  return window;
}

/**
 * Reconstructs 4 discrete Stems from sequential ChunkInferenceResult objects
 * using normalized overlap-add blending.
 */
export function reconstructStemsFromChunks(
  results: ChunkInferenceResult[],
  totalSamples: number,
  options: ChunkOptions = {}
): Record<StemName, Float32Array[]> {
  const chunkSamples = options.chunkSamples ?? DEFAULT_CHUNK_SAMPLES;
  const overlapSamples = Math.min(
    options.overlapSamples ?? DEFAULT_OVERLAP_SAMPLES,
    Math.floor(chunkSamples / 2)
  );

  // Determine number of channels from first result
  const numChannels = results[0]?.stems.vocals.length ?? 2;

  // Initialize accumulator buffers and weight normalization buffer
  const accumulators: Record<StemName, Float32Array[]> = {
    vocals: Array.from(
      { length: numChannels },
      () => new Float32Array(totalSamples)
    ),
    drums: Array.from(
      { length: numChannels },
      () => new Float32Array(totalSamples)
    ),
    bass: Array.from(
      { length: numChannels },
      () => new Float32Array(totalSamples)
    ),
    other: Array.from(
      { length: numChannels },
      () => new Float32Array(totalSamples)
    ),
  };

  const weightSum = new Float32Array(totalSamples);
  const totalChunks = results.length;

  for (let idx = 0; idx < totalChunks; idx++) {
    const res = results[idx];
    const isFirst = idx === 0;
    const isLast = idx === totalChunks - 1;
    const valid = res.validSamples;

    const window = createChunkWindow(valid, overlapSamples, isFirst, isLast);

    for (let i = 0; i < valid; i++) {
      const globalIdx = res.startSample + i;
      if (globalIdx >= totalSamples) break;

      const w = window[i];
      weightSum[globalIdx] += w;

      for (const stemName of STEM_NAMES) {
        const stemChannels = res.stems[stemName];
        for (let c = 0; c < numChannels; c++) {
          accumulators[stemName][c][globalIdx] += stemChannels[c][i] * w;
        }
      }
    }
  }

  // Normalize by weight sum to guarantee flat unity gain across all overlap regions
  const reconstructed: Record<StemName, Float32Array[]> = {
    vocals: Array.from(
      { length: numChannels },
      () => new Float32Array(totalSamples)
    ),
    drums: Array.from(
      { length: numChannels },
      () => new Float32Array(totalSamples)
    ),
    bass: Array.from(
      { length: numChannels },
      () => new Float32Array(totalSamples)
    ),
    other: Array.from(
      { length: numChannels },
      () => new Float32Array(totalSamples)
    ),
  };

  for (let i = 0; i < totalSamples; i++) {
    const w = weightSum[i];
    const scale = w > 1e-6 ? 1 / w : 1.0;

    for (const stemName of STEM_NAMES) {
      for (let c = 0; c < numChannels; c++) {
        reconstructed[stemName][c][i] = accumulators[stemName][c][i] * scale;
      }
    }
  }

  return reconstructed;
}
