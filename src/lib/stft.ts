/**
 * STFT (Short-Time Fourier Transform) & iSTFT processor for BS-RoFormer ONNX.
 *
 * Implements exact parity with PyTorch's torch.stft and torch.istft:
 * - n_fft: 2048
 * - hop_length: 441 (10ms @ 44.1kHz)
 * - win_length: 2048
 * - window: Periodic Hann window
 * - center: true (reflect padding)
 * - normalized: false
 */

import { fftRadix2InPlace } from "./fftRadix2";
import { StemName } from "./chunkOverlapAdd";

export const BS_ROFORMER_CHUNK_SAMPLES = 176400; // 4.0s @ 44.1kHz (T=345 frames for BS-RoFormer-SW)
export const BS_ROFORMER_N_FFT = 2048;
export const BS_ROFORMER_HOP_LENGTH = 512;
export const BS_ROFORMER_WIN_LENGTH = 2048;
export const BS_ROFORMER_F = 1025; // n_fft / 2 + 1
export const BS_ROFORMER_T = 345; // Math.floor(176400 / 512) + 1

function makeHannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  const factor = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos(factor * i));
  }
  return w;
}

function reflectIndex(i: number, len: number): number {
  if (i >= 0 && i < len) return i;
  if (len <= 1) return 0;
  const period = 2 * (len - 1);
  i = ((i % period) + period) % period;
  return i < len ? i : period - i;
}

export interface STFTResult {
  real: Float32Array; // [2, F, T] planar
  imag: Float32Array; // [2, F, T] planar
  F: number;
  T: number;
}

/**
 * Computes forward STFT on stereo audio [left, right] matching torch.stft.
 */
export function computeStereoSTFT(
  left: Float32Array,
  right: Float32Array,
  length: number = BS_ROFORMER_CHUNK_SAMPLES,
  nFft: number = BS_ROFORMER_N_FFT,
  hopLength: number = BS_ROFORMER_HOP_LENGTH,
  winLength: number = BS_ROFORMER_WIN_LENGTH
): STFTResult {
  const window = makeHannWindow(winLength);
  const halfNFft = Math.floor(nFft / 2);
  const T = Math.floor(length / hopLength) + 1;
  const F = halfNFft + 1;
  const numChannels = 2;

  const real = new Float32Array(numChannels * F * T);
  const imag = new Float32Array(numChannels * F * T);
  const fftBuf = new Float32Array(nFft * 2);
  const channels = [left, right];

  for (let c = 0; c < numChannels; c++) {
    const channelData = channels[c];
    const chanOffset = c * F * T;

    for (let t = 0; t < T; t++) {
      const frameStart = t * hopLength - halfNFft;

      for (let i = 0; i < nFft; i++) {
        const srcIdx = reflectIndex(frameStart + i, length);
        fftBuf[i * 2] = channelData[srcIdx] * window[i];
        fftBuf[i * 2 + 1] = 0;
      }

      fftRadix2InPlace(fftBuf, nFft);

      for (let k = 0; k < F; k++) {
        const outIdx = chanOffset + k * T + t;
        real[outIdx] = fftBuf[k * 2];
        imag[outIdx] = fftBuf[k * 2 + 1];
      }
    }
  }

  return { real, imag, F, T };
}

interface ISTFTCacheEntry {
  windowInvN: Float32Array;
  invWindowSum: Float32Array;
  paddedLen: number;
  pad: number;
}

const istftCache = new Map<string, ISTFTCacheEntry>();

function getISTFTCache(
  nFft: number,
  T: number,
  hopLength: number,
  winLength: number
): ISTFTCacheEntry {
  const key = `${nFft}-${T}-${hopLength}-${winLength}`;
  let entry = istftCache.get(key);
  if (entry) return entry;

  const window = makeHannWindow(winLength);
  const pad = Math.floor(nFft / 2);
  const paddedLen = (T - 1) * hopLength + nFft;
  const windowSum = new Float32Array(paddedLen);

  for (let t = 0; t < T; t++) {
    const frameStart = t * hopLength;
    for (let i = 0; i < nFft; i++) {
      windowSum[frameStart + i] += window[i] * window[i];
    }
  }

  const invN = 1 / nFft;
  const windowInvN = new Float32Array(nFft);
  for (let i = 0; i < nFft; i++) {
    windowInvN[i] = window[i] * invN;
  }

  const invWindowSum = new Float32Array(paddedLen);
  for (let i = 0; i < paddedLen; i++) {
    invWindowSum[i] = windowSum[i] > 1e-8 ? 1 / windowSum[i] : 0;
  }

  entry = { windowInvN, invWindowSum, paddedLen, pad };
  istftCache.set(key, entry);
  return entry;
}

// Canonical BS-RoFormer 4-stem order
export const BS_ROFORMER_STEM_ORDER: StemName[] = [
  "drums",
  "bass",
  "other",
  "vocals",
];

/**
 * Computes batched iSTFT for BS-RoFormer outputs.
 * Input shapes: real and imag are [numStems, 2, F, T] planar.
 * Handles both 6-stem (bass, drums, other, vocals, guitar, piano) and 4-stem architectures,
 * producing 4 standard isolated stems: drums, bass, vocals, other.
 */
export function computeBatchISTFT(
  outSpecReal: Float32Array,
  outSpecImag: Float32Array,
  length: number = BS_ROFORMER_CHUNK_SAMPLES,
  nFft: number = BS_ROFORMER_N_FFT,
  hopLength: number = BS_ROFORMER_HOP_LENGTH,
  winLength: number = BS_ROFORMER_WIN_LENGTH,
  numStemsInOutput: number = 6
): Record<StemName, Float32Array[]> {
  const F = Math.floor(nFft / 2) + 1;
  const T = Math.floor(length / hopLength) + 1;
  const numChannels = 2;

  const { windowInvN, invWindowSum, paddedLen, pad } = getISTFTCache(
    nFft,
    T,
    hopLength,
    winLength
  );

  const rawStems: Float32Array[][] = Array.from(
    { length: numStemsInOutput },
    () => [new Float32Array(length), new Float32Array(length)]
  );

  const fftBuf = new Float32Array(nFft * 2);
  const padded = new Float32Array(paddedLen);
  const sliceStride = F * T;
  const perStemStride = numChannels * sliceStride;

  for (let s = 0; s < numStemsInOutput; s++) {
    for (let c = 0; c < numChannels; c++) {
      const inOff = s * perStemStride + c * sliceStride;
      padded.fill(0);

      for (let t = 0; t < T; t++) {
        // iFFT via FFT(conj(X)) / N
        fftBuf[0] = outSpecReal[inOff + 0 * T + t];
        fftBuf[1] = -outSpecImag[inOff + 0 * T + t];
        fftBuf[(F - 1) * 2] = outSpecReal[inOff + (F - 1) * T + t];
        fftBuf[(F - 1) * 2 + 1] = -outSpecImag[inOff + (F - 1) * T + t];

        for (let k = 1; k < F - 1; k++) {
          const idx = inOff + k * T + t;
          const re = outSpecReal[idx];
          const im = -outSpecImag[idx];
          fftBuf[k * 2] = re;
          fftBuf[k * 2 + 1] = im;
          const mirror = nFft - k;
          fftBuf[mirror * 2] = re;
          fftBuf[mirror * 2 + 1] = -im;
        }

        fftBuf[F * 2] = 0;
        fftBuf[F * 2 + 1] = 0;
        fftRadix2InPlace(fftBuf, nFft);

        const frameStart = t * hopLength;
        for (let i = 0; i < nFft; i++) {
          padded[frameStart + i] += fftBuf[i * 2] * windowInvN[i];
        }
      }

      const outChannel = rawStems[s][c];
      for (let i = 0; i < length; i++) {
        outChannel[i] = padded[pad + i] * invWindowSum[pad + i];
      }
    }
  }

  // 6-stem BS-RoFormer order: 0=bass, 1=drums, 2=other, 3=vocals, 4=guitar, 5=piano
  if (numStemsInOutput >= 6) {
    const bass = rawStems[0];
    const drums = rawStems[1];
    const vocals = rawStems[3];

    // Combine other (2) + guitar (4) + piano (5) into complete "other" stem
    const other = [new Float32Array(length), new Float32Array(length)];
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < length; i++) {
        other[c][i] = rawStems[2][c][i] + rawStems[4][c][i] + rawStems[5][c][i];
      }
    }

    return { vocals, drums, bass, other };
  }

  // 4-stem BS-RoFormer fallback order: 0=drums, 1=bass, 2=other, 3=vocals
  return {
    drums: rawStems[0],
    bass: rawStems[1],
    other: rawStems[2],
    vocals: rawStems[3],
  };
}
