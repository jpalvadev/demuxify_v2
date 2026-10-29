export interface SourceMixMetadata {
  fileName: string;
  fileSize: number;
  duration: number; // in seconds
  sampleRate: number;
  numberOfChannels: number;
}

import { createAudioContext } from "./audioContext";

export interface DecodedSourceMix {
  buffer: AudioBuffer;
  metadata: SourceMixMetadata;
}

export interface DecodeAudioOptions {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  audioContext?: AudioContext;
}

function getAudioContext(provided?: AudioContext): AudioContext {
  if (provided) return provided;
  return createAudioContext({ sampleRate: 44100 });
}

async function fileToArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return await file.arrayBuffer();
  }
  if (typeof FileReader !== "undefined") {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () =>
        reject(reader.error || new Error("Failed to read file as ArrayBuffer"));
      reader.readAsArrayBuffer(file);
    });
  }
  return new Response(file).arrayBuffer();
}

/**
 * Decodes an audio File or ArrayBuffer into a normalized AudioBuffer
 * and extracts standard audio metadata.
 */
export async function decodeAudio(
  source: File | ArrayBuffer,
  options?: DecodeAudioOptions
): Promise<DecodedSourceMix> {
  let fileName: string;
  let fileSize: number;
  let arrayBuffer: ArrayBuffer;

  if (
    source instanceof File ||
    (typeof Blob !== "undefined" && source instanceof Blob)
  ) {
    fileName = "name" in source ? (source as File).name : "Source Mix";
    fileSize = source.size;
    if (fileSize === 0) {
      throw new Error(
        `Audio file "${fileName}" is empty (0 bytes). Please select a valid audio file.`
      );
    }
    arrayBuffer = await fileToArrayBuffer(source);
  } else {
    fileName = options?.fileName ?? "Source Mix";
    fileSize = options?.fileSize ?? source.byteLength;
    if (source.byteLength === 0) {
      throw new Error(
        `Audio file "${fileName}" is empty (0 bytes). Please select a valid audio file.`
      );
    }
    arrayBuffer = source;
  }

  const audioContext = getAudioContext(options?.audioContext);

  // decodeAudioData detaches the underlying buffer in Web Audio API.
  // We slice a copy to avoid neutering the caller's buffer.
  const bufferCopy = arrayBuffer.slice(0);

  let decodedBuffer: AudioBuffer;
  try {
    // Standard Promise-based decodeAudioData with legacy callback fallback if needed
    decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      const promise = audioContext.decodeAudioData(
        bufferCopy,
        (buffer) => resolve(buffer),
        (err) => reject(err)
      );
      if (promise && typeof promise.then === "function") {
        promise.then(resolve).catch(reject);
      }
    });

    // Ensure decoded buffer is strictly 44100 Hz for Demucs neural network
    if (
      decodedBuffer.sampleRate !== 44100 &&
      typeof window !== "undefined" &&
      (window.OfflineAudioContext ||
        (
          window as unknown as {
            webkitOfflineAudioContext?: typeof OfflineAudioContext;
          }
        ).webkitOfflineAudioContext)
    ) {
      try {
        const OfflineCtxClass =
          window.OfflineAudioContext ||
          (
            window as unknown as {
              webkitOfflineAudioContext: typeof OfflineAudioContext;
            }
          ).webkitOfflineAudioContext;
        const targetLength = Math.max(
          1,
          Math.round(decodedBuffer.duration * 44100)
        );
        const offlineCtx = new OfflineCtxClass(
          decodedBuffer.numberOfChannels,
          targetLength,
          44100
        );
        const sourceNode = offlineCtx.createBufferSource();
        sourceNode.buffer = decodedBuffer;
        sourceNode.connect(offlineCtx.destination);
        sourceNode.start(0);
        decodedBuffer = await offlineCtx.startRendering();
      } catch {
        // Keep original decoded buffer if offline rendering is unsupported
      }
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "The audio file appears corrupted, incomplete, or uses an unsupported encoding format.";
    throw new Error(`Failed to decode audio file "${fileName}": ${errorMsg}`);
  }

  const metadata: SourceMixMetadata = {
    fileName,
    fileSize,
    duration: decodedBuffer.duration,
    sampleRate: decodedBuffer.sampleRate,
    numberOfChannels: decodedBuffer.numberOfChannels,
  };

  return {
    buffer: decodedBuffer,
    metadata,
  };
}
