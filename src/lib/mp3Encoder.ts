import {
  encodePcmToMp3,
  Mp3Bitrate,
  VALID_MP3_BITRATES,
  Mp3WorkerRequest,
  Mp3WorkerResponse,
} from '../workers/mp3Encoder.worker';

export type { Mp3Bitrate };
export { VALID_MP3_BITRATES };
export const encodeMp3Buffer = encodePcmToMp3;

export interface Mp3EncodeOptions {
  sampleRate?: number;
  bitrate?: Mp3Bitrate;
  onProgress?: (progress: number) => void;
  worker?: Worker;
}

/**
 * Encodes audio channels (or an AudioBuffer) into an MP3 byte stream (Uint8Array).
 * If a Web Worker environment is available, encoding runs off the main thread.
 */
export async function encodeMp3(
  source: Float32Array[] | AudioBuffer,
  options?: Mp3EncodeOptions
): Promise<Uint8Array> {
  let channels: Float32Array[];
  let sampleRate = options?.sampleRate ?? 44100;

  if ('numberOfChannels' in source) {
    sampleRate = source.sampleRate;
    channels = [];
    for (let ch = 0; ch < source.numberOfChannels; ch++) {
      channels.push(source.getChannelData(ch));
    }
  } else {
    channels = source;
  }

  const bitrate = options?.bitrate ?? 192;
  const onProgress = options?.onProgress;
  const isMockWorker = typeof Worker !== 'undefined' && (Worker.name === 'MockWorker' || (Worker as any).__isMock);

  // If in browser with real Worker support or explicit worker provided
  if (typeof Worker !== 'undefined' && (!isMockWorker || options?.worker)) {
    return new Promise<Uint8Array>((resolve, reject) => {
      let worker: Worker | null = null;
      try {
        worker =
          options?.worker ??
          new Worker(new URL('../workers/mp3Encoder.worker.ts', import.meta.url), {
            type: 'module',
          });
      } catch (err) {
        // Fallback to in-thread encoding if worker instantiation fails (e.g. strict CSP / mock env)
        try {
          const res = encodeMp3Buffer(channels, sampleRate, bitrate, onProgress);
          resolve(res);
          return;
        } catch (innerErr) {
          reject(innerErr);
          return;
        }
      }

      const reqId = `mp3-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const cleanup = () => {
        if (!options?.worker && worker) {
          worker.terminate();
        }
      };

      worker.onmessage = (e: MessageEvent<Mp3WorkerResponse>) => {
        const msg = e.data;
        if (!msg || msg.id !== reqId) return;

        if (msg.type === 'progress') {
          onProgress?.(msg.progress);
        } else if (msg.type === 'success') {
          cleanup();
          resolve(new Uint8Array(msg.mp3Data));
        } else if (msg.type === 'error') {
          cleanup();
          reject(new Error(msg.error));
        }
      };

      worker.onerror = (err) => {
        cleanup();
        reject(err instanceof Error ? err : new Error('MP3 Worker execution error'));
      };

      const req: Mp3WorkerRequest = {
        id: reqId,
        type: 'encode',
        channels,
        sampleRate,
        bitrate,
      };

      worker.postMessage(req);
    });
  }

  // Fallback if Worker is completely undefined (e.g. Node / unit testing)
  return Promise.resolve(encodeMp3Buffer(channels, sampleRate, bitrate, onProgress));
}

/**
 * Creates an audio/mp3 Blob from audio channels or AudioBuffer.
 */
export async function createMp3Blob(
  source: Float32Array[] | AudioBuffer,
  options?: Mp3EncodeOptions
): Promise<Blob> {
  const bytes = await encodeMp3(source, options);
  return new Blob([bytes as BlobPart], { type: 'audio/mp3' });
}
