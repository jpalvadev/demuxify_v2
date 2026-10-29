import { describe, it, expect } from 'vitest';
import {
  createChunkSegments,
  reconstructStemsFromChunks,
  STEM_NAMES,
  StemName,
  ChunkInferenceResult,
} from '../lib/chunkOverlapAdd';

describe('Chunk Segmentation and Overlap-Add', () => {
  const sampleRate = 44100;
  const chunkSamples = 44100; // 1 second chunk for easy testing
  const overlapSamples = 4410; // 0.1 second overlap (10%)

  it('correctly slices stereo audio into sequential Chunk Segments with overlap', () => {
    // 2.5 seconds of stereo audio (110250 samples)
    const totalSamples = 110250;
    const left = new Float32Array(totalSamples);
    const right = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
      right[i] = Math.cos((2 * Math.PI * 440 * i) / sampleRate);
    }

    const audio = [left, right];
    const chunks = createChunkSegments(audio, {
      chunkSamples,
      overlapSamples,
    });

    // Step is chunkSamples - overlapSamples = 44100 - 4410 = 39690
    // Total chunks: ceil((110250 - 4410) / 39690) = ceil(105840 / 39690) = 3 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    // Verify first chunk starts at 0
    expect(chunks[0].startSample).toBe(0);
    expect(chunks[0].audio[0].length).toBe(chunkSamples);
    expect(chunks[0].audio[1].length).toBe(chunkSamples);

    // Verify chunk 1 starts at step
    const step = chunkSamples - overlapSamples;
    expect(chunks[1].startSample).toBe(step);

    // Verify last chunk covers up to totalSamples
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.startSample + lastChunk.validSamples).toBe(totalSamples);
  });

  it('handles audio shorter than one chunk without throwing', () => {
    const totalSamples = 10000;
    const audio = [new Float32Array(totalSamples), new Float32Array(totalSamples)];

    const chunks = createChunkSegments(audio, {
      chunkSamples,
      overlapSamples,
    });

    expect(chunks.length).toBe(1);
    expect(chunks[0].startSample).toBe(0);
    expect(chunks[0].validSamples).toBe(totalSamples);
    expect(chunks[0].audio[0].length).toBe(chunkSamples); // zero-padded to model chunk size
  });

  it('reconstructs 4 discrete stems with exact sample length and smooth overlap blending', () => {
    const totalSamples = 100000;
    const left = new Float32Array(totalSamples).fill(0.8);
    const right = new Float32Array(totalSamples).fill(0.4);
    const audio = [left, right];

    const chunks = createChunkSegments(audio, {
      chunkSamples,
      overlapSamples,
    });

    // Mock inference result for each chunk:
    // vocals: audio * 1.0
    // drums: audio * 0.5
    // bass: audio * 0.25
    // other: audio * 0.1
    const inferenceResults: ChunkInferenceResult[] = chunks.map((chunk) => {
      const stems: Record<StemName, Float32Array[]> = {
        vocals: [
          chunk.audio[0].map((v) => v * 1.0),
          chunk.audio[1].map((v) => v * 1.0),
        ],
        drums: [
          chunk.audio[0].map((v) => v * 0.5),
          chunk.audio[1].map((v) => v * 0.5),
        ],
        bass: [
          chunk.audio[0].map((v) => v * 0.25),
          chunk.audio[1].map((v) => v * 0.25),
        ],
        other: [
          chunk.audio[0].map((v) => v * 0.1),
          chunk.audio[1].map((v) => v * 0.1),
        ],
      };
      return {
        chunkIndex: chunk.chunkIndex,
        startSample: chunk.startSample,
        validSamples: chunk.validSamples,
        stems,
      };
    });

    const reconstructed = reconstructStemsFromChunks(
      inferenceResults,
      totalSamples,
      { chunkSamples, overlapSamples }
    );

    // Verify all 4 stems are present
    expect(Object.keys(reconstructed).sort()).toEqual([...STEM_NAMES].sort());

    for (const stemName of STEM_NAMES) {
      expect(reconstructed[stemName].length).toBe(2);
      expect(reconstructed[stemName][0].length).toBe(totalSamples);
      expect(reconstructed[stemName][1].length).toBe(totalSamples);
    }

    // Verify seamless reconstruction across overlap boundaries without ripple/clicks
    // At sample 50000 (deep inside the overlap zone of chunks):
    // vocals left should be ~0.8
    expect(reconstructed.vocals[0][50000]).toBeCloseTo(0.8, 3);
    expect(reconstructed.vocals[1][50000]).toBeCloseTo(0.4, 3);

    // drums left should be ~0.4 (0.8 * 0.5)
    expect(reconstructed.drums[0][50000]).toBeCloseTo(0.4, 3);
    expect(reconstructed.drums[1][50000]).toBeCloseTo(0.2, 3);

    // bass left should be ~0.2 (0.8 * 0.25)
    expect(reconstructed.bass[0][50000]).toBeCloseTo(0.2, 3);

    // other left should be ~0.08 (0.8 * 0.1)
    expect(reconstructed.other[0][50000]).toBeCloseTo(0.08, 3);
  });

  it('handles empty audio gracefully', () => {
    const chunks = createChunkSegments([]);
    expect(chunks).toEqual([]);

    const emptyChunks = createChunkSegments([new Float32Array(0)]);
    expect(emptyChunks).toEqual([]);
  });

  it('handles mono audio correctly', () => {
    const totalSamples = 20000;
    const mono = [new Float32Array(totalSamples).fill(0.5)];
    const chunks = createChunkSegments(mono, { chunkSamples: 10000, overlapSamples: 2000 });
    expect(chunks.length).toBe(3);
    expect(chunks[0].audio.length).toBe(1);

    const mockResults: ChunkInferenceResult[] = chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      startSample: c.startSample,
      validSamples: c.validSamples,
      stems: {
        vocals: [c.audio[0].slice()],
        drums: [c.audio[0].slice()],
        bass: [c.audio[0].slice()],
        other: [c.audio[0].slice()],
      },
    }));

    const result = reconstructStemsFromChunks(mockResults, totalSamples, {
      chunkSamples: 10000,
      overlapSamples: 2000,
    });
    expect(result.vocals.length).toBe(1);
    expect(result.vocals[0].length).toBe(totalSamples);
    expect(result.vocals[0][5000]).toBeCloseTo(0.5, 3);
  });
});

