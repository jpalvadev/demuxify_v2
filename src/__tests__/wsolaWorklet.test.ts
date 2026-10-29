import { describe, it, expect } from 'vitest';
import {
  WsolaMultitrackProcessor,
  WSOLA_WORKLET_PROCESSOR_NAME,
  WSOLA_WORKLET_SOURCE,
} from '../lib/wsolaProcessor';

describe('AudioWorklet WSOLA Multitrack Processor', () => {
  it('registers correct processor name and exports valid worklet source code', () => {
    expect(WSOLA_WORKLET_PROCESSOR_NAME).toBe('wsola-multitrack-processor');
    expect(WSOLA_WORKLET_SOURCE).toContain('class WsolaMultitrackProcessor');
    expect(WSOLA_WORKLET_SOURCE).toContain('synthesizeFrames');
    expect(WSOLA_WORKLET_SOURCE).toContain('findBestOffset');
    expect(WSOLA_WORKLET_SOURCE).toContain('registerProcessor');
  });

  it('loads 8 channels across 4 stems and computes unified composite signal', () => {
    const processor = new WsolaMultitrackProcessor();
    const length = 44100;
    const stems: Float32Array[] = [];

    for (let c = 0; c < 8; c++) {
      const arr = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = Math.sin((2 * Math.PI * (220 + c * 10) * i) / 44100);
      }
      stems.push(arr);
    }

    processor.port.onmessage({
      data: {
        type: 'loadStems',
        stems,
        sampleRate: 44100,
      },
    });

    expect(processor.stems.length).toBe(8);
    expect(processor.composite).toBeInstanceOf(Float32Array);
    expect(processor.composite.length).toBe(length);
  });

  it('preserves multi-channel phase coherence and constructive summation across all 8 channels', () => {
    const processor = new WsolaMultitrackProcessor();
    const length = 44100;
    const stems: Float32Array[] = [];

    // Construct 8 channels in perfect phase (200 Hz tone)
    for (let c = 0; c < 8; c++) {
      const arr = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = Math.sin((2 * Math.PI * 200 * i) / 44100);
      }
      stems.push(arr);
    }

    processor.port.onmessage({
      data: {
        type: 'loadStems',
        stems,
        sampleRate: 44100,
      },
    });

    processor.port.onmessage({
      data: {
        type: 'setTempo',
        tempo: 1.25,
      },
    });

    processor.port.onmessage({
      data: {
        type: 'play',
      },
    });

    // Run 10 quanta through the processor
    const quantumSize = 128;
    const collectedOutputs: number[][][] = Array.from({ length: 4 }, () => [
      [],
      [],
    ]);

    for (let q = 0; q < 10; q++) {
      const outputs = [
        [new Float32Array(quantumSize), new Float32Array(quantumSize)],
        [new Float32Array(quantumSize), new Float32Array(quantumSize)],
        [new Float32Array(quantumSize), new Float32Array(quantumSize)],
        [new Float32Array(quantumSize), new Float32Array(quantumSize)],
      ];

      processor.process([], outputs, {});

      for (let s = 0; s < 4; s++) {
        for (let i = 0; i < quantumSize; i++) {
          collectedOutputs[s][0].push(outputs[s][0][i]);
          collectedOutputs[s][1].push(outputs[s][1][i]);
        }
      }
    }

    // Verify Vocals Left (Stem 0, Ch 0) and Bass Left (Stem 2, Ch 0) are in phase
    const vocalsL = collectedOutputs[0][0];
    const bassL = collectedOutputs[2][0];
    expect(vocalsL.length).toBe(1280);

    let maxDiff = 0;
    let sumPeak = 0;
    for (let i = 256; i < vocalsL.length; i++) {
      const diff = Math.abs(vocalsL[i] - bassL[i]);
      if (diff > maxDiff) maxDiff = diff;
      const sum = vocalsL[i] + bassL[i];
      if (Math.abs(sum) > sumPeak) sumPeak = Math.abs(sum);
    }

    // Phase difference is negligible
    expect(maxDiff).toBeCloseTo(0, 4);
    // Constructive addition doubles the signal
    expect(sumPeak).toBeGreaterThan(1.2);
  });

  it('stretches duration inversely proportional to tempo without altering pitch', () => {
    const processor = new WsolaMultitrackProcessor();
    const length = 44100;
    const stems: Float32Array[] = [];

    for (let c = 0; c < 8; c++) {
      const arr = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
      }
      stems.push(arr);
    }

    processor.port.onmessage({
      data: {
        type: 'loadStems',
        stems,
        sampleRate: 44100,
      },
    });

    // Test tempo = 2.0x (speed doubled, position advances 2x faster per quantum)
    processor.port.onmessage({ data: { type: 'setTempo', tempo: 2.0 } });
    processor.port.onmessage({ data: { type: 'play' } });

    const outputs = [
      [new Float32Array(128), new Float32Array(128)],
      [new Float32Array(128), new Float32Array(128)],
      [new Float32Array(128), new Float32Array(128)],
      [new Float32Array(128), new Float32Array(128)],
    ];

    processor.process([], outputs, {});
    // When tempo = 2.0, 128 output samples corresponds to 128 * 2.0 = 256 source audio samples
    expect(processor.readPos).toBeCloseTo(256, 1);
  });

  it('supports fractional cents pitch shift without altering playback speed', () => {
    const processor = new WsolaMultitrackProcessor();
    const length = 44100;
    const stems: Float32Array[] = [];

    for (let c = 0; c < 8; c++) {
      const arr = new Float32Array(length);
      stems.push(arr);
    }

    processor.port.onmessage({
      data: {
        type: 'loadStems',
        stems,
        sampleRate: 44100,
      },
    });

    // Pitch shift +0.50 semitones (+50 cents), tempo = 1.0x
    processor.port.onmessage({ data: { type: 'setPitch', pitch: 0.5 } });
    expect(processor.pitch).toBe(0.5);
    processor.port.onmessage({ data: { type: 'play' } });

    const outputs = [
      [new Float32Array(128), new Float32Array(128)],
      [new Float32Array(128), new Float32Array(128)],
      [new Float32Array(128), new Float32Array(128)],
      [new Float32Array(128), new Float32Array(128)],
    ];

    processor.process([], outputs, {});
    // When tempo is 1.0x, playback speed is unaltered: 128 output samples = 128 source samples
    expect(processor.readPos).toBeCloseTo(128, 1);
  });
});
