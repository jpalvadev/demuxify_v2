import { Mp3Encoder } from '@breezystack/lamejs';

export type Mp3Bitrate = 128 | 192 | 256 | 320;
export const VALID_MP3_BITRATES: Mp3Bitrate[] = [128, 192, 256, 320];

export interface Mp3WorkerRequest {
  id: string;
  type: 'encode';
  channels: Float32Array[];
  sampleRate: number;
  bitrate: Mp3Bitrate;
}

export type Mp3WorkerResponse =
  | { id: string; type: 'progress'; progress: number }
  | { id: string; type: 'success'; mp3Data: ArrayBuffer }
  | { id: string; type: 'error'; error: string };

function floatToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }
  return int16;
}

/**
 * Encodes audio PCM channels into MP3 bytes using LameJS.
 */
export function encodePcmToMp3(
  channels: Float32Array[],
  sampleRate: number,
  bitrate: Mp3Bitrate,
  onProgress?: (progress: number) => void
): Uint8Array {
  if (!channels || channels.length === 0) {
    throw new Error('encodePcmToMp3 requires at least one audio channel');
  }

  if (!VALID_MP3_BITRATES.includes(bitrate)) {
    throw new Error(
      `Invalid bitrate ${bitrate} kbps. Valid options are: ${VALID_MP3_BITRATES.join(', ')}`
    );
  }

  const numChannels = channels.length > 1 ? 2 : 1;
  const numSamples = channels[0].length;
  const encoder = new Mp3Encoder(numChannels, sampleRate, bitrate);

  const leftInt16 = floatToInt16(channels[0]);
  const rightInt16 = numChannels > 1 ? floatToInt16(channels[1]) : undefined;

  const mp3DataChunks: Uint8Array[] = [];
  const chunkSize = 1152; // Standard MPEG-1 Layer 3 frame size

  for (let offset = 0; offset < numSamples; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, numSamples);
    const leftChunk = leftInt16.subarray(offset, end);

    let mp3Chunk: Int8Array | Uint8Array;
    if (numChannels === 1 || !rightInt16) {
      mp3Chunk = encoder.encodeBuffer(leftChunk) as any;
    } else {
      const rightChunk = rightInt16.subarray(offset, end);
      mp3Chunk = encoder.encodeBuffer(leftChunk, rightChunk) as any;
    }

    if (mp3Chunk.length > 0) {
      mp3DataChunks.push(new Uint8Array(mp3Chunk.buffer, mp3Chunk.byteOffset, mp3Chunk.byteLength));
    }

    if (onProgress) {
      onProgress(Math.min(1, end / numSamples));
    }
  }

  const flushChunk = encoder.flush() as any;
  if (flushChunk.length > 0) {
    mp3DataChunks.push(new Uint8Array(flushChunk.buffer, flushChunk.byteOffset, flushChunk.byteLength));
  }

  if (onProgress) {
    onProgress(1);
  }

  const totalLength = mp3DataChunks.reduce((acc, curr) => acc + curr.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of mp3DataChunks) {
    result.set(chunk, pos);
    pos += chunk.byteLength;
  }

  return result;
}

/**
 * Message handler for worker context and testable worker interface.
 */
export async function handleMp3WorkerMessage(
  data: Mp3WorkerRequest,
  postMessage: (msg: Mp3WorkerResponse, transfer?: Transferable[]) => void
): Promise<void> {
  const { id, type, channels, sampleRate, bitrate } = data;

  if (type !== 'encode') {
    postMessage({ id, type: 'error', error: `Unknown request type: ${type}` });
    return;
  }

  try {
    const mp3Bytes = encodePcmToMp3(channels, sampleRate, bitrate, (progress) => {
      postMessage({ id, type: 'progress', progress });
    });

    const buffer = mp3Bytes.buffer.slice(
      mp3Bytes.byteOffset,
      mp3Bytes.byteOffset + mp3Bytes.byteLength
    ) as ArrayBuffer;
    postMessage({ id, type: 'success', mp3Data: buffer }, [buffer]);
  } catch (err) {
    postMessage({
      id,
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// In standard Web Worker context, bind message event listener
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<Mp3WorkerRequest>) => {
    handleMp3WorkerMessage(e.data, (msg, transfer) => {
      if (transfer) {
        (self as unknown as Worker).postMessage(msg, transfer);
      } else {
        (self as unknown as Worker).postMessage(msg);
      }
    });
  };
}
