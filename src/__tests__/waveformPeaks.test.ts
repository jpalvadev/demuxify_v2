import { describe, it, expect } from 'vitest';
import { computeWaveformPeaks, WaveformPeaks } from '../lib/waveformPeaks';

describe('waveformPeaks', () => {
  it('computes min and max peaks for a mono audio buffer', () => {
    // 10 samples, 1 channel
    const channelData = new Float32Array([
      0.0, 0.5, -0.8, 0.2, -0.1,
      0.9, -0.4, 0.1, -0.6, 0.3,
    ]);

    const mockBuffer = {
      numberOfChannels: 1,
      length: channelData.length,
      sampleRate: 44100,
      duration: channelData.length / 44100,
      getChannelData: () => channelData,
    };

    // Downsample into 2 bins:
    // Bin 0 (first 5 samples: 0.0, 0.5, -0.8, 0.2, -0.1) -> min: -0.8, max: 0.5
    // Bin 1 (next 5 samples: 0.9, -0.4, 0.1, -0.6, 0.3) -> min: -0.6, max: 0.9
    const peaks: WaveformPeaks = computeWaveformPeaks(mockBuffer as any, {
      targetBins: 2,
    });

    expect(peaks.length).toBe(2);
    expect(peaks.min.length).toBe(2);
    expect(peaks.max.length).toBe(2);

    expect(peaks.min[0]).toBeCloseTo(-0.8, 4);
    expect(peaks.max[0]).toBeCloseTo(0.5, 4);
    expect(peaks.min[1]).toBeCloseTo(-0.6, 4);
    expect(peaks.max[1]).toBeCloseTo(0.9, 4);
  });

  it('merges multi-channel (stereo) peaks correctly', () => {
    // 4 samples per channel
    // Left channel: has high positive peak in bin 0
    const leftChannel = new Float32Array([0.8, -0.1, 0.2, -0.3]);
    // Right channel: has large negative peak in bin 0 and large positive in bin 1
    const rightChannel = new Float32Array([0.1, -0.9, 0.7, -0.2]);

    const mockBuffer = {
      numberOfChannels: 2,
      length: 4,
      sampleRate: 44100,
      duration: 4 / 44100,
      getChannelData: (ch: number) => (ch === 0 ? leftChannel : rightChannel),
    };

    // Downsample into 2 bins:
    // Bin 0 (samples 0..1): Left has (0.8, -0.1), Right has (0.1, -0.9)
    // -> Combined min: -0.9, Combined max: 0.8
    // Bin 1 (samples 2..3): Left has (0.2, -0.3), Right has (0.7, -0.2)
    // -> Combined min: -0.3, Combined max: 0.7
    const peaks = computeWaveformPeaks(mockBuffer as any, { targetBins: 2 });

    expect(peaks.length).toBe(2);
    expect(peaks.min[0]).toBeCloseTo(-0.9, 4);
    expect(peaks.max[0]).toBeCloseTo(0.8, 4);
    expect(peaks.min[1]).toBeCloseTo(-0.3, 4);
    expect(peaks.max[1]).toBeCloseTo(0.7, 4);
  });

  it('clamps peak bounds strictly within [-1, 1]', () => {
    // Samples with clipping beyond [-1, 1]
    const channelData = new Float32Array([1.5, -2.0, 0.0, 0.4]);

    const mockBuffer = {
      numberOfChannels: 1,
      length: 4,
      sampleRate: 44100,
      duration: 4 / 44100,
      getChannelData: () => channelData,
    };

    const peaks = computeWaveformPeaks(mockBuffer as any, { targetBins: 2 });

    expect(peaks.max[0]).toBeLessThanOrEqual(1.0);
    expect(peaks.min[0]).toBeGreaterThanOrEqual(-1.0);
    expect(peaks.max[0]).toBe(1.0);
    expect(peaks.min[0]).toBe(-1.0);
  });

  it('handles empty or zero-length audio buffers safely', () => {
    const mockEmptyBuffer = {
      numberOfChannels: 1,
      length: 0,
      sampleRate: 44100,
      duration: 0,
      getChannelData: () => new Float32Array(0),
    };

    const peaks = computeWaveformPeaks(mockEmptyBuffer as any, { targetBins: 100 });
    expect(peaks.length).toBe(0);
    expect(peaks.min.length).toBe(0);
    expect(peaks.max.length).toBe(0);
  });

  it('handles completely silent audio buffers', () => {
    const silentBuffer = {
      numberOfChannels: 2,
      length: 100,
      sampleRate: 44100,
      duration: 100 / 44100,
      getChannelData: () => new Float32Array(100),
    };

    const peaks = computeWaveformPeaks(silentBuffer as any, { targetBins: 10 });
    expect(peaks.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(peaks.min[i]).toBe(0);
      expect(peaks.max[i]).toBe(0);
    }
  });

  it('uses reasonable default targetBins when omitted', () => {
    const channelData = new Float32Array(10000);
    channelData[500] = 0.5;
    channelData[501] = -0.5;

    const mockBuffer = {
      numberOfChannels: 1,
      length: 10000,
      sampleRate: 44100,
      duration: 10000 / 44100,
      getChannelData: () => channelData,
    };

    const peaks = computeWaveformPeaks(mockBuffer as any);
    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks.min.length).toBe(peaks.length);
    expect(peaks.max.length).toBe(peaks.length);
  });
});
