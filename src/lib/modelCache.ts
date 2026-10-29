/**
 * Model Cache module for persistent storage of ONNX model weights.
 *
 * Uses Cache Storage API (with fallback) to store and retrieve weights
 * across browser sessions, supporting stream progress reporting.
 */

export const MODEL_CACHE_NAME = "demuxify-model-cache-v1";
export const DEFAULT_MODEL_URL =
  "https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx/resolve/main/bs_roformer_sw_6stem_fp16.onnx";

export interface DownloadProgress {
  loadedBytes: number;
  totalBytes: number;
  progress: number;
}

/**
 * Checks if Cache Storage API is available in current environment.
 */
function isCacheStorageAvailable(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    "caches" in globalThis &&
    typeof globalThis.caches?.open === "function"
  );
}

/**
 * Checks if model weights are already stored in Model Cache.
 */
export async function isModelCached(
  url: string = DEFAULT_MODEL_URL
): Promise<boolean> {
  if (!isCacheStorageAvailable()) {
    return false;
  }
  try {
    const cache = await globalThis.caches.open(MODEL_CACHE_NAME);
    const match = await cache.match(url);
    return Boolean(match);
  } catch {
    return false;
  }
}

/**
 * Deletes model weights from Model Cache, or deletes entire cache if no url provided.
 */
export async function clearModelCache(url?: string): Promise<boolean> {
  if (!isCacheStorageAvailable()) {
    return false;
  }
  try {
    if (url) {
      const cache = await globalThis.caches.open(MODEL_CACHE_NAME);
      return await cache.delete(url);
    } else {
      return await globalThis.caches.delete(MODEL_CACHE_NAME);
    }
  } catch {
    return false;
  }
}

/**
 * Retrieves ONNX model weights as an ArrayBuffer.
 * First inspects Model Cache; if absent, streams from the network,
 * emits progress callbacks, and persists the payload into Model Cache.
 */
export async function getModelWeights(
  url: string = DEFAULT_MODEL_URL,
  onProgress?: (progress: DownloadProgress) => void
): Promise<ArrayBuffer> {
  // 1. Try to fetch from Cache Storage
  if (isCacheStorageAvailable()) {
    try {
      const cache = await globalThis.caches.open(MODEL_CACHE_NAME);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        const buffer = await cachedResponse.arrayBuffer();
        onProgress?.({
          loadedBytes: buffer.byteLength,
          totalBytes: buffer.byteLength,
          progress: 1,
        });
        return buffer;
      }
    } catch {
      // Continue to network fetch on cache read error
    }
  }

  // 2. Fetch from network with stream progress reporting
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download model weights from ${url}: ${response.status} ${response.statusText}`
    );
  }

  const contentLengthHeader = response.headers.get("Content-Length");
  const totalBytes = contentLengthHeader
    ? parseInt(contentLengthHeader, 10)
    : 0;

  let buffer: ArrayBuffer;

  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loadedBytes += value.byteLength;
        const progress =
          totalBytes > 0 ? Math.min(loadedBytes / totalBytes, 1) : 0;
        onProgress?.({
          loadedBytes,
          totalBytes: totalBytes > 0 ? totalBytes : loadedBytes,
          progress,
        });
      }
    }

    // Concatenate chunks
    const merged = new Uint8Array(loadedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    buffer = merged.buffer;
  } else {
    // Fallback if readable stream is unavailable
    buffer = await response.arrayBuffer();
    onProgress?.({
      loadedBytes: buffer.byteLength,
      totalBytes: buffer.byteLength,
      progress: 1,
    });
  }

  // 3. Persist to cache
  if (isCacheStorageAvailable()) {
    try {
      const cache = await globalThis.caches.open(MODEL_CACHE_NAME);
      // Response constructor accepts ArrayBuffer
      const responseToCache = new Response(buffer.slice(0), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": buffer.byteLength.toString(),
        },
      });
      await cache.put(url, responseToCache);
    } catch (err) {
      console.warn("Failed to persist model weights to Model Cache:", err);
    }
  }

  return buffer;
}
