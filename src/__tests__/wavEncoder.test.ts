import { describe, it, expect } from 'vitest';
import { encodeWav, encodeAudioBufferToWav } from '../lib/wavEncoder';

describe('wavEncoder', () => {
  it('encodes 16-bit stereo PCM audio with valid RIFF WAVE headers', () => {
    const left = new Float32Array([0, 0.5, -0.5, 1.0, -1.0]);
    const right = new Float32Array([0, -0.5, 0.5, -1.0, 1.0]);
    const sampleRate = 44100;

    const wavBytes = encodeWav([left, right], { sampleRate, bitDepth: 16 });
    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);

    // RIFF chunk descriptor
    const riff = String.fromCharCode(...wavBytes.slice(0, 4));
    expect(riff).toBe('RIFF');
    // ChunkSize: 36 + SubChunk2Size (44 - 8 + 5 * 2 * 2 = 36 + 20 = 56)
    expect(view.getUint32(4, true)).toBe(36 + 20);

    // Format
    const wave = String.fromCharCode(...wavBytes.slice(8, 12));
    expect(wave).toBe('WAVE');

    // fmt subchunk
    const fmt = String.fromCharCode(...wavBytes.slice(12, 16));
    expect(fmt).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16); // Subchunk1Size = 16 for PCM
    expect(view.getUint16(20, true)).toBe(1); // AudioFormat = 1 (PCM)
    expect(view.getUint16(22, true)).toBe(2); // NumChannels = 2
    expect(view.getUint32(24, true)).toBe(44100); // SampleRate
    expect(view.getUint32(28, true)).toBe(44100 * 2 * 2); // ByteRate = SampleRate * NumChannels * BitsPerSample/8
    expect(view.getUint16(32, true)).toBe(4); // BlockAlign = NumChannels * BitsPerSample/8
    expect(view.getUint16(34, true)).toBe(16); // BitsPerSample = 16

    // data subchunk
    const data = String.fromCharCode(...wavBytes.slice(36, 40));
    expect(data).toBe('data');
    expect(view.getUint32(40, true)).toBe(20); // Subchunk2Size: 5 samples * 2 channels * 2 bytes = 20

    // Sample payload verification (16-bit little endian)
    // Sample 0: left=0 -> 0, right=0 -> 0
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(0);

    // Sample 1: left=0.5 -> ~16383, right=-0.5 -> -16384
    expect(view.getInt16(48, true)).toBe(Math.round(0.5 * 32767));
    expect(view.getInt16(50, true)).toBe(Math.round(-0.5 * 32768));

    // Sample 3: left=1.0 -> 32767, right=-1.0 -> -32768
    expect(view.getInt16(56, true)).toBe(32767);
    expect(view.getInt16(58, true)).toBe(-32768);
  });

  it('encodes 24-bit PCM audio with correct 3-byte packing and headers', () => {
    const mono = new Float32Array([0, 1.0, -1.0]);
    const sampleRate = 48000;

    const wavBytes = encodeWav([mono], { sampleRate, bitDepth: 24 });
    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);

    expect(String.fromCharCode(...wavBytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wavBytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // 1 channel
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(28, true)).toBe(48000 * 1 * 3); // ByteRate
    expect(view.getUint16(32, true)).toBe(3); // BlockAlign
    expect(view.getUint16(34, true)).toBe(24); // BitsPerSample
    expect(view.getUint32(40, true)).toBe(3 * 3); // 3 samples * 1 ch * 3 bytes = 9

    // Check sample 1 (1.0 -> 8388607 = 0x7FFFFF)
    // 3 bytes little endian: FF, FF, 7F
    const s1b0 = wavBytes[44 + 3];
    const s1b1 = wavBytes[44 + 4];
    const s1b2 = wavBytes[44 + 5];
    const s1Val = s1b0 | (s1b1 << 8) | (s1b2 << 16);
    expect(s1Val).toBe(8388607);

    // Check sample 2 (-1.0 -> -8388608 = 0x800000)
    // 3 bytes little endian: 00, 00, 80
    const s2b0 = wavBytes[44 + 6];
    const s2b1 = wavBytes[44 + 7];
    const s2b2 = wavBytes[44 + 8];
    // reconstruct signed 24-bit
    let s2Val = s2b0 | (s2b1 << 8) | (s2b2 << 16);
    if (s2Val & 0x800000) s2Val |= 0xff000000;
    expect(s2Val).toBe(-8388608);
  });

  it('clamps out-of-bounds float values to maximum allowed integer range', () => {
    const channel = new Float32Array([1.5, -2.0]);
    const wavBytes = encodeWav([channel], { sampleRate: 44100, bitDepth: 16 });
    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);

    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });

  it('encodes AudioBuffer instance using encodeAudioBufferToWav helper', () => {
    const audioBuffer = {
      numberOfChannels: 2,
      sampleRate: 44100,
      length: 10,
      getChannelData: (ch: number) => new Float32Array(10).fill(ch === 0 ? 0.25 : -0.25),
    } as unknown as AudioBuffer;

    const wavBytes = encodeAudioBufferToWav(audioBuffer, { bitDepth: 16 });
    expect(wavBytes.byteLength).toBe(44 + 10 * 2 * 2);

    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getInt16(44, true)).toBe(Math.round(0.25 * 32767));
    expect(view.getInt16(46, true)).toBe(Math.round(-0.25 * 32768));
  });

  it('throws an error if channels array is empty', () => {
    expect(() => encodeWav([])).toThrow();
  });
});
