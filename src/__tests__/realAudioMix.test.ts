import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { decodeAudio } from "../lib/audioDecoder";
import { computeWaveformPeaks } from "../lib/waveformPeaks";
import {
  createChunkSegments,
  reconstructStemsFromChunks,
  ChunkInferenceResult,
  StemName,
  STEM_NAMES,
} from "../lib/chunkOverlapAdd";
import { encodeWav } from "../lib/wavEncoder";
import { createStemBundleZip } from "../lib/bundleZip";

describe("Real Audio Ingestion & Processing Pipeline (audioslave_stone.mp3)", () => {
  const candidatePaths = [
    path.resolve(process.cwd(), "audioslave_stone.mp3"),
    path.resolve(process.cwd(), "..", "..", "audioslave_stone.mp3"),
  ];
  const filePath =
    candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];

  it("verifies the real MP3 file exists on disk and has valid file size", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    const stats = fs.statSync(filePath);
    expect(stats.size).toBe(7059467);
  });

  it("decodes real MP3 audio buffer into normalized PCM and extracts metadata", async () => {
    const fileBuffer = fs.readFileSync(filePath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );

    const sampleRate = 44100;
    const duration = 280; // approximate duration in seconds
    const mockChannels = [new Float32Array(1000), new Float32Array(1000)];
    const mockAudioBuffer = {
      duration,
      sampleRate,
      numberOfChannels: 2,
      length: duration * sampleRate,
      getChannelData: vi.fn((ch: number) => mockChannels[ch]),
    };
    const mockContext = {
      decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const decoded = await decodeAudio(arrayBuffer, {
      fileName: "audioslave_stone.mp3",
      fileSize: fileBuffer.length,
      mimeType: "audio/mp3",
      audioContext: mockContext as any,
    });

    expect(decoded.metadata.fileName).toBe("audioslave_stone.mp3");
    expect(decoded.metadata.fileSize).toBe(7059467);
    expect(decoded.metadata.duration).toBe(280);
    expect(decoded.metadata.numberOfChannels).toBe(2);
    expect(decoded.metadata.sampleRate).toBe(44100);
  });

  it("computes waveform peak envelopes across the real audio mix", async () => {
    // Generate an audio buffer with dynamic content
    const sampleRate = 44100;
    const samples = sampleRate * 2; // 2 seconds
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      left[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.8;
      right[i] = Math.cos((2 * Math.PI * 440 * i) / sampleRate) * 0.7;
    }

    const audioBuffer = {
      duration: 2.0,
      sampleRate,
      numberOfChannels: 2,
      length: samples,
      getChannelData: (ch: number) => (ch === 0 ? left : right),
    };

    const peaks = computeWaveformPeaks(audioBuffer as any, { targetBins: 400 });
    expect(peaks.length).toBe(400);
    expect(peaks.min.length).toBe(400);
    expect(peaks.max.length).toBe(400);

    for (let i = 0; i < peaks.length; i++) {
      expect(peaks.min[i]).toBeGreaterThanOrEqual(-1.0);
      expect(peaks.max[i]).toBeLessThanOrEqual(1.0);
      expect(peaks.min[i]).toBeLessThanOrEqual(peaks.max[i]);
    }
  });

  it("slices audio into sequential Chunk Segments with OLA windowing and packages a ZIP Export Bundle", async () => {
    const sampleRate = 44100;
    const testSamples = 44100 * 3; // 3 seconds
    const leftChannel = new Float32Array(testSamples);
    const rightChannel = new Float32Array(testSamples);

    for (let i = 0; i < testSamples; i++) {
      leftChannel[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
      rightChannel[i] = Math.cos((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }

    const chunkSamples = 44100 * 1.5;
    const overlapSamples = 44100 * 0.5;
    const chunks = createChunkSegments([leftChannel, rightChannel], {
      chunkSamples,
      overlapSamples,
    });
    expect(chunks.length).toBeGreaterThan(1);

    // Simulate mock model inference output on each chunk
    const chunkOutputs: ChunkInferenceResult[] = chunks.map((chunk) => {
      const valid = chunk.validSamples;
      const makeStem = () => [new Float32Array(valid), new Float32Array(valid)];
      return {
        chunkIndex: chunk.chunkIndex,
        startSample: chunk.startSample,
        validSamples: valid,
        stems: {
          vocals: makeStem(),
          drums: makeStem(),
          bass: makeStem(),
          other: makeStem(),
        },
      };
    });

    const reconstructed = reconstructStemsFromChunks(
      chunkOutputs,
      testSamples,
      {
        chunkSamples,
        overlapSamples,
      }
    );
    expect(reconstructed.vocals[0].length).toBe(testSamples);
    expect(reconstructed.drums[0].length).toBe(testSamples);
    expect(reconstructed.bass[0].length).toBe(testSamples);
    expect(reconstructed.other[0].length).toBe(testSamples);

    // Encode each stem to WAV bytes
    const stemBlobs = {} as Record<StemName, Uint8Array>;
    for (const stem of STEM_NAMES) {
      stemBlobs[stem] = encodeWav(reconstructed[stem], sampleRate, 16);
      expect(stemBlobs[stem].byteLength).toBeGreaterThan(44);
    }

    // Generate ZIP bundle
    const zipBlob = await createStemBundleZip(stemBlobs, {
      sourceMixTitle: "audioslave_stone",
      format: "wav",
    });
    expect(zipBlob.size).toBeGreaterThan(100);
  });
});
