import { describe, it, expect } from "vitest";
import {
  computeStereoSTFT,
  computeBatchISTFT,
  BS_ROFORMER_CHUNK_SAMPLES,
  BS_ROFORMER_F,
  BS_ROFORMER_T,
  BS_ROFORMER_STEM_ORDER,
} from "../lib/stft";

describe("BS-RoFormer STFT & iSTFT Engine", () => {
  it("computes forward STFT with exact expected shape [2, 1025, 801]", () => {
    const length = BS_ROFORMER_CHUNK_SAMPLES;
    const left = new Float32Array(length);
    const right = new Float32Array(length);

    // Fill with sample sinusoidal frequencies
    for (let i = 0; i < length; i++) {
      left[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
      right[i] = Math.cos((2 * Math.PI * 880 * i) / 44100);
    }

    const { real, imag, F, T } = computeStereoSTFT(left, right, length);

    expect(F).toBe(BS_ROFORMER_F);
    expect(T).toBe(BS_ROFORMER_T);
    expect(real.length).toBe(2 * BS_ROFORMER_F * BS_ROFORMER_T);
    expect(imag.length).toBe(2 * BS_ROFORMER_F * BS_ROFORMER_T);
  });

  it("reconstructs time-domain audio from spectrogram via inverse STFT with high mathematical fidelity", () => {
    const length = 44100 * 2; // 2 seconds test length
    const left = new Float32Array(length);
    const right = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      left[i] = Math.sin((2 * Math.PI * 330 * i) / 44100) * 0.7;
      right[i] = Math.cos((2 * Math.PI * 660 * i) / 44100) * 0.7;
    }

    const { real, imag, F, T } = computeStereoSTFT(left, right, length);

    // Pack into [4, 2, F, T] where stem 0 (drums) receives the signal
    const outReal = new Float32Array(4 * 2 * F * T);
    const outImag = new Float32Array(4 * 2 * F * T);
    outReal.set(real, 0);
    outImag.set(imag, 0);

    const reconstructed = computeBatchISTFT(outReal, outImag, length);

    expect(Object.keys(reconstructed)).toEqual(BS_ROFORMER_STEM_ORDER);
    const recDrumsLeft = reconstructed.drums[0];
    const recDrumsRight = reconstructed.drums[1];

    expect(recDrumsLeft.length).toBe(length);
    expect(recDrumsRight.length).toBe(length);

    // Check maximum reconstruction error on interior frames
    let maxError = 0;
    const margin = 2048; // avoid boundary edge effects
    for (let i = margin; i < length - margin; i++) {
      const errL = Math.abs(recDrumsLeft[i] - left[i]);
      const errR = Math.abs(recDrumsRight[i] - right[i]);
      if (errL > maxError) maxError = errL;
      if (errR > maxError) maxError = errR;
    }

    expect(maxError).toBeLessThan(0.001);
  });
});
