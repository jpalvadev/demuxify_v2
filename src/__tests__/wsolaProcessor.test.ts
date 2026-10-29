import { describe, it, expect, vi } from 'vitest';
import {
  semitonesToPitchRatio,
  pitchRatioToSemitones,
  calculateEffectiveWsolaAlpha,
  createHannWindow,
  resampleChannel,
  findBestOffset,
  WsolaProcessor,
  registerWsolaAudioWorklet,
} from '../lib/wsolaProcessor';

describe('WSOLA Pitch & Windowing Math', () => {
  it('converts semitones to pitch ratio accurately', () => {
    // 0 semitones = 1.0
    expect(semitonesToPitchRatio(0)).toBeCloseTo(1.0, 5);
    // +12 semitones = 2.0 (one octave up)
    expect(semitonesToPitchRatio(12)).toBeCloseTo(2.0, 5);
    // -12 semitones = 0.5 (one octave down)
    expect(semitonesToPitchRatio(-12)).toBeCloseTo(0.5, 5);
    // +7 semitones (perfect fifth) = 2^(7/12) ~ 1.498307
    expect(semitonesToPitchRatio(7)).toBeCloseTo(Math.pow(2, 7 / 12), 5);
    // -7 semitones (perfect fourth down) = 2^(-7/12) ~ 0.667419
    expect(semitonesToPitchRatio(-7)).toBeCloseTo(Math.pow(2, -7 / 12), 5);
  });

  it('inverts pitch ratio back to semitones', () => {
    expect(pitchRatioToSemitones(1.0)).toBeCloseTo(0, 4);
    expect(pitchRatioToSemitones(2.0)).toBeCloseTo(12, 4);
    expect(pitchRatioToSemitones(0.5)).toBeCloseTo(-12, 4);
    expect(pitchRatioToSemitones(Math.pow(2, 3 / 12))).toBeCloseTo(3, 4);
  });

  it('calculates effective WSOLA time-stretch factor alpha', () => {
    // alpha = tempo / pitchRatio
    // When tempo = 1.0, pitch = 0 (ratio = 1.0) -> alpha = 1.0
    expect(calculateEffectiveWsolaAlpha(1.0, 0)).toBeCloseTo(1.0, 5);

    // When tempo = 1.5, pitch = 0 -> alpha = 1.5
    expect(calculateEffectiveWsolaAlpha(1.5, 0)).toBeCloseTo(1.5, 5);

    // When tempo = 1.0, pitch = 12 (pitchRatio = 2.0) -> alpha = 0.5
    // WSOLA slows down by 0.5x, then resampling speeds up by 2.0x -> net tempo = 1.0x
    expect(calculateEffectiveWsolaAlpha(1.0, 12)).toBeCloseTo(0.5, 5);

    // When tempo = 1.0, pitch = -12 (pitchRatio = 0.5) -> alpha = 2.0
    expect(calculateEffectiveWsolaAlpha(1.0, -12)).toBeCloseTo(2.0, 5);

    // When tempo = 1.5, pitch = 12 -> alpha = 1.5 / 2.0 = 0.75
    expect(calculateEffectiveWsolaAlpha(1.5, 12)).toBeCloseTo(0.75, 5);
  });

  it('creates Hann window with 50% overlap constant sum property', () => {
    const size = 64;
    const window = createHannWindow(size);

    expect(window.length).toBe(size);
    // Endpoints near 0
    expect(window[0]).toBeCloseTo(0, 4);
    // Midpoint is 1.0
    expect(window[size / 2]).toBeCloseTo(1.0, 4);

    // In 50% overlap (hop = size / 2), w[i] + w[i + size/2] = 1.0
    const hop = size / 2;
    for (let i = 0; i < hop; i++) {
      const sum = window[i] + window[i + hop];
      expect(sum).toBeCloseTo(1.0, 4);
    }
  });

  it('resamples a channel accurately with linear interpolation', () => {
    // Ramp signal [0, 1, 2, 3, 4]
    const input = new Float32Array([0, 1, 2, 3, 4]);

    // Resampling with ratio 1.0 returns identical values
    const resampledSame = resampleChannel(input, 1.0);
    expect(Array.from(resampledSame)).toEqual(Array.from(input));

    // Resampling with ratio 2.0 (step size 2.0 -> half length: indices 0, 2, 4)
    const resampledHalf = resampleChannel(input, 2.0);
    expect(resampledHalf.length).toBe(2);
    expect(resampledHalf[0]).toBeCloseTo(0, 5);
    expect(resampledHalf[1]).toBeCloseTo(2, 5);

    // Resampling with ratio 0.5 (step size 0.5 -> double length)
    const resampledDouble = resampleChannel(input, 0.5);
    expect(resampledDouble.length).toBe(10);
    expect(resampledDouble[0]).toBeCloseTo(0, 5);
    expect(resampledDouble[1]).toBeCloseTo(0.5, 5);
    expect(resampledDouble[2]).toBeCloseTo(1.0, 5);
    expect(resampledDouble[3]).toBeCloseTo(1.5, 5);
  });

  it('finds the best offset via cross-correlation similarity', () => {
    // Create a periodic signal (sine wave)
    const sampleRate = 1000;
    const freq = 50; // period = 20 samples
    const length = 200;
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      signal[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }

    // Reference starts at sample 20
    const refPos = 20;
    const windowSize = 40;
    // Target nominal is at sample 35 (displaced by -5 from sample 40, which is exactly 1 period ahead)
    const nominalTargetPos = 35;
    const searchRange = 10; // search in [35 - 10, 35 + 10] = [25, 45]

    // The signal repeats every 20 samples, so sample 20 + 20 = 40 has perfect correlation!
    // Offset should be +5 (so 35 + 5 = 40).
    const bestDelta = findBestOffset(signal, refPos, nominalTargetPos, windowSize, searchRange);
    expect(bestDelta).toBe(5);
  });
});

describe('Multi-Channel WSOLA Processor & Inter-Stem Phase Synchronization', () => {
  it('passes through 8 channels unchanged at 1.0x tempo and 0 semitones pitch', () => {
    const numChannels = 8;
    const length = 2048;
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      const arr = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = Math.sin((2 * Math.PI * (100 + c * 20) * i) / 1000);
      }
      channels.push(arr);
    }

    const processor = new WsolaProcessor({
      channels: numChannels,
      windowSize: 256,
      hopSize: 128,
      searchRange: 64,
    });

    const result = processor.process(channels, { tempo: 1.0, pitch: 0 });

    expect(result.length).toBe(numChannels);
    expect(result[0].length).toBe(length);
    // Identical at 1.0x tempo and 0 pitch
    for (let c = 0; c < numChannels; c++) {
      for (let i = 0; i < length; i++) {
        expect(result[c][i]).toBeCloseTo(channels[c][i], 5);
      }
    }
  });

  it('scales tempo (0.5x to 2.0x) inversely proportional to duration without pitch shift', () => {
    const numChannels = 8;
    const length = 4000;
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      const arr = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
      }
      channels.push(arr);
    }

    const processor = new WsolaProcessor({
      channels: numChannels,
      windowSize: 256,
      hopSize: 128,
      searchRange: 64,
    });

    // Test 1.5x tempo -> duration should be approximately length / 1.5 ~ 2666
    const faster = processor.process(channels, { tempo: 1.5, pitch: 0 });
    expect(faster.length).toBe(8);
    expect(faster[0].length).toBeCloseTo(Math.floor(length / 1.5), -2);

    // Test 0.75x tempo -> duration should be approximately length / 0.75 ~ 5333
    const slower = processor.process(channels, { tempo: 0.75, pitch: 0 });
    expect(slower.length).toBe(8);
    expect(slower[0].length).toBeCloseTo(Math.floor(length / 0.75), -2);
  });

  it('shifts pitch (-12 to +12 semitones) without altering duration or tempo', () => {
    const numChannels = 8;
    const sampleRate = 44100;
    const length = 4410; // 0.1 sec
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      const arr = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
      }
      channels.push(arr);
    }

    const processor = new WsolaProcessor({
      channels: numChannels,
      windowSize: 256,
      hopSize: 128,
      searchRange: 64,
    });

    // +7 semitones pitch shift, 1.0x tempo
    const shifted = processor.process(channels, { tempo: 1.0, pitch: 7 });
    expect(shifted.length).toBe(8);
    // Duration remains close to original length
    expect(shifted[0].length).toBeCloseTo(length, -2);
  });

  it('maintains strict inter-stem phase synchronization across all 8 channels preventing comb filtering', () => {
    // Construct 4 stereo stems (8 channels total):
    // Vocals L/R (ch 0, 1), Drums L/R (ch 2, 3), Bass L/R (ch 4, 5), Other L/R (ch 6, 7)
    // Drums and Bass have a strict in-phase relationship at 200 Hz
    const numChannels = 8;
    const length = 4410;
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      const arr = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        // All channels share the same fundamental phase
        arr[i] = Math.sin((2 * Math.PI * 200 * i) / 44100);
      }
      channels.push(arr);
    }

    const processor = new WsolaProcessor({
      channels: numChannels,
      windowSize: 256,
      hopSize: 128,
      searchRange: 64,
    });

    // Process with time stretch (e.g. 1.25x tempo)
    const stretched = processor.process(channels, { tempo: 1.25, pitch: 0 });

    // Verify that across all 8 channels, channel 0 and channel 4 (Vocals L and Bass L)
    // are still exactly in phase at every sample (correlation == 1.0, difference == 0)
    const outLen = stretched[0].length;
    let maxDiff = 0;
    for (let i = 0; i < outLen; i++) {
      const diff = Math.abs(stretched[0][i] - stretched[4][i]);
      if (diff > maxDiff) maxDiff = diff;
    }
    expect(maxDiff).toBeCloseTo(0, 5);

    // Summing channels 0 and 4 results in constructive addition (double amplitude),
    // proving zero comb-filtering or phase cancellation occurred!
    let sumPeak = 0;
    for (let i = 0; i < outLen; i++) {
      const sum = stretched[0][i] + stretched[4][i];
      if (Math.abs(sum) > sumPeak) sumPeak = Math.abs(sum);
    }
    expect(sumPeak).toBeGreaterThan(1.5); // 2 * amplitude (~2.0)
  });

  it('clamps tempo to [0.5, 2.0] and pitch to [-12, +12]', () => {
    const processor = new WsolaProcessor();
    processor.setTempo(0.1);
    expect(processor.getTempo()).toBe(0.5);

    processor.setTempo(3.5);
    expect(processor.getTempo()).toBe(2.0);

    processor.setPitch(-20);
    expect(processor.getPitch()).toBe(-12);

    processor.setPitch(25);
    expect(processor.getPitch()).toBe(12);

    processor.reset();
    expect(processor.getTempo()).toBe(1.0);
    expect(processor.getPitch()).toBe(0);
  });

  it('handles AudioWorklet registration gracefully', async () => {
    // Unsupported / missing audioWorklet
    const fakeContextNoWorklet = {} as any;
    expect(await registerWsolaAudioWorklet(fakeContextNoWorklet)).toBe(false);

    // Supported audioWorklet with addModule
    const mockAddModule = vi.fn().mockResolvedValue(undefined);
    const fakeContextWithWorklet = {
      audioWorklet: {
        addModule: mockAddModule,
      },
    } as any;
    expect(await registerWsolaAudioWorklet(fakeContextWithWorklet)).toBe(true);
    expect(mockAddModule).toHaveBeenCalled();

    // Throwing addModule
    const failingContext = {
      audioWorklet: {
        addModule: vi.fn().mockRejectedValue(new Error('Blocked')),
      },
    } as any;
    expect(await registerWsolaAudioWorklet(failingContext)).toBe(false);
  });
});
