/**
 * WAV PCM Audio Encoder
 * Encodes multi-channel Float32Array PCM into standard RIFF WAVE format (16-bit and 24-bit PCM).
 */

export interface WavEncodeOptions {
  bitDepth?: 16 | 24;
  sampleRate?: number;
}

/**
 * Encodes audio channels (Float32Array per channel) into a standard RIFF WAVE Uint8Array.
 */
export function encodeWav(
  channels: Float32Array[],
  options?: WavEncodeOptions
): Uint8Array {
  if (!channels || channels.length === 0) {
    throw new Error('encodeWav requires at least one channel');
  }

  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const bitDepth = options?.bitDepth ?? 16;
  const sampleRate = options?.sampleRate ?? 44100;

  if (bitDepth !== 16 && bitDepth !== 24) {
    throw new Error(`Unsupported bit depth: ${bitDepth}. Supported depths are 16 and 24.`);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const totalBufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(totalBufferSize);
  const view = new DataView(buffer);

  // 1. RIFF chunk descriptor
  // "RIFF"
  writeAsciiString(view, 0, 'RIFF');
  // ChunkSize: 36 + SubChunk2Size
  view.setUint32(4, 36 + dataSize, true);
  // "WAVE"
  writeAsciiString(view, 8, 'WAVE');

  // 2. "fmt " sub-chunk
  writeAsciiString(view, 12, 'fmt ');
  // Subchunk1Size = 16 for PCM
  view.setUint32(16, 16, true);
  // AudioFormat = 1 (Linear PCM)
  view.setUint16(20, 1, true);
  // NumChannels
  view.setUint16(22, numChannels, true);
  // SampleRate
  view.setUint32(24, sampleRate, true);
  // ByteRate
  view.setUint32(28, byteRate, true);
  // BlockAlign
  view.setUint16(32, blockAlign, true);
  // BitsPerSample
  view.setUint16(34, bitDepth, true);

  // 3. "data" sub-chunk
  writeAsciiString(view, 36, 'data');
  // Subchunk2Size
  view.setUint32(40, dataSize, true);

  // 4. Interleave & write PCM audio data
  let offset = 44;

  if (bitDepth === 16) {
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const floatVal = channels[ch][i];
        // Clamp to [-1, 1]
        const clamped = Math.max(-1, Math.min(1, floatVal));
        const intSample = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
  } else {
    // 24-bit PCM: 3 bytes per sample little endian
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const floatVal = channels[ch][i];
        const clamped = Math.max(-1, Math.min(1, floatVal));
        const intSample = clamped < 0 ? Math.round(clamped * 8388608) : Math.round(clamped * 8388607);
        // Write 3 bytes little endian
        view.setUint8(offset, intSample & 0xff);
        view.setUint8(offset + 1, (intSample >> 8) & 0xff);
        view.setUint8(offset + 2, (intSample >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Convenience helper to encode an AudioBuffer to WAV format.
 */
export function encodeAudioBufferToWav(
  audioBuffer: AudioBuffer,
  options?: WavEncodeOptions
): Uint8Array {
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }
  return encodeWav(channels, {
    sampleRate: audioBuffer.sampleRate,
    bitDepth: options?.bitDepth,
  });
}

/**
 * Creates a standard audio/wav Blob from channels or AudioBuffer.
 */
export function createWavBlob(
  channels: Float32Array[] | AudioBuffer,
  options?: WavEncodeOptions
): Blob {
  const uint8 =
    'numberOfChannels' in channels
      ? encodeAudioBufferToWav(channels, options)
      : encodeWav(channels, options);
  return new Blob([uint8 as BlobPart], { type: 'audio/wav' });
}

function writeAsciiString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
