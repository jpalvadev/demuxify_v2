import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getModelWeights,
  isModelCached,
  clearModelCache,
  DownloadProgress,
  MODEL_CACHE_NAME,
  OBSOLETE_CACHE_NAMES,
} from "../lib/modelCache";

describe("Model Cache", () => {
  const TEST_MODEL_URL = "https://example.com/models/bs_roformer.onnx";
  const dummyData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  let mockCacheStore: Map<string, Response>;
  let mockCache: {
    match: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCacheStore = new Map();

    mockCache = {
      match: vi.fn(async (request: string | Request) => {
        const key = typeof request === "string" ? request : request.url;
        const res = mockCacheStore.get(key);
        return res ? res.clone() : undefined;
      }),
      put: vi.fn(async (request: string | Request, response: Response) => {
        const key = typeof request === "string" ? request : request.url;
        mockCacheStore.set(key, response.clone());
      }),
      delete: vi.fn(async (request: string | Request) => {
        const key = typeof request === "string" ? request : request.url;
        return mockCacheStore.delete(key);
      }),
    };

    // Mock global caches
    (globalThis as any).caches = {
      open: vi.fn(async (_name: string) => mockCache),
      delete: vi.fn(async (_name: string) => true),
    };
  });

  it("checks if model is cached", async () => {
    const cachedBefore = await isModelCached(TEST_MODEL_URL);
    expect(cachedBefore).toBe(false);

    mockCacheStore.set(TEST_MODEL_URL, new Response(dummyData.buffer));

    const cachedAfter = await isModelCached(TEST_MODEL_URL);
    expect(cachedAfter).toBe(true);
  });

  it("returns cached weights directly without network fetch when cached", async () => {
    mockCacheStore.set(TEST_MODEL_URL, new Response(dummyData.buffer));

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const progressUpdates: DownloadProgress[] = [];

    const weights = await getModelWeights(TEST_MODEL_URL, (p) =>
      progressUpdates.push(p)
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(new Uint8Array(weights)).toEqual(dummyData);
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].progress).toBe(1);
    expect(progressUpdates[progressUpdates.length - 1].loadedBytes).toBe(
      dummyData.byteLength
    );
  });

  it("downloads model weights with stream progress reporting and caches the result", async () => {
    const chunks = [
      new Uint8Array([1, 2]),
      new Uint8Array([3, 4, 5]),
      new Uint8Array([6, 7, 8]),
    ];
    const totalBytes = 8;

    let chunkIndex = 0;
    const readableStream = new ReadableStream({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(chunks[chunkIndex]);
          chunkIndex++;
        } else {
          controller.close();
        }
      },
    });

    const mockResponse = new Response(readableStream, {
      headers: {
        "Content-Length": totalBytes.toString(),
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const progressUpdates: DownloadProgress[] = [];
    const weights = await getModelWeights(TEST_MODEL_URL, (p) =>
      progressUpdates.push(p)
    );

    expect(new Uint8Array(weights)).toEqual(dummyData);
    expect(progressUpdates.length).toBe(3);
    const expectedUpdates: DownloadProgress[] = [
      { loadedBytes: 2, totalBytes: 8, progress: 0.25 },
      { loadedBytes: 5, totalBytes: 8, progress: 0.625 },
      { loadedBytes: 8, totalBytes: 8, progress: 1 },
    ];
    expect(progressUpdates).toEqual(expectedUpdates);

    // Verify it saved to cache
    expect(mockCache.put).toHaveBeenCalledWith(
      TEST_MODEL_URL,
      expect.any(Response)
    );
    expect(mockCacheStore.has(TEST_MODEL_URL)).toBe(true);
  });

  it("can clear model cache", async () => {
    mockCacheStore.set(TEST_MODEL_URL, new Response(dummyData.buffer));
    expect(await isModelCached(TEST_MODEL_URL)).toBe(true);

    const cleared = await clearModelCache(TEST_MODEL_URL);
    expect(cleared).toBe(true);
    expect(await isModelCached(TEST_MODEL_URL)).toBe(false);
  });

  it("gracefully handles missing Cache API environment", async () => {
    delete (globalThis as any).caches;

    const mockResponse = new Response(dummyData.buffer, {
      headers: { "Content-Length": dummyData.byteLength.toString() },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const isCached = await isModelCached(TEST_MODEL_URL);
    expect(isCached).toBe(false);

    const weights = await getModelWeights(TEST_MODEL_URL);
    expect(new Uint8Array(weights)).toEqual(dummyData);
  });

  it("aligns to BS-RoFormer cache standard and automatically purges legacy HTDemucs caches", async () => {
    expect(MODEL_CACHE_NAME).toBe("demuxify-roformer-cache-v1");
    expect(OBSOLETE_CACHE_NAMES).toContain("demuxify-model-cache-v1");
    expect(OBSOLETE_CACHE_NAMES).toContain("demuxify-model-cache-v2");
    expect(OBSOLETE_CACHE_NAMES).toContain("demuxify-model-cache-v3");
    expect(OBSOLETE_CACHE_NAMES).toContain("demuxify-model-cache-v4");

    mockCacheStore.set(TEST_MODEL_URL, new Response(dummyData.buffer));

    await getModelWeights(TEST_MODEL_URL);

    for (const obsoleteName of OBSOLETE_CACHE_NAMES) {
      expect((globalThis as any).caches.delete).toHaveBeenCalledWith(
        obsoleteName
      );
    }
  });

  it("supports isolated cache partitions for different model profiles", async () => {
    const roformerUrl = "/models/bs_roformer_4stem_webgpu.onnx";
    const htdemucsUrl = "/models/htdemucs_4stem_mobile.onnx";
    const htdemucsCacheName = "demuxify-htdemucs-cache-v1";
    const roformerCacheName = "demuxify-roformer-cache-v1";

    const htdemucsStore = new Map<string, Response>();
    const htdemucsMockCache = {
      match: vi.fn(async (req: string) => htdemucsStore.get(req)?.clone()),
      put: vi.fn(async (req: string, res: Response) => {
        htdemucsStore.set(req, res.clone());
      }),
      delete: vi.fn(async (req: string) => htdemucsStore.delete(req)),
    };

    (globalThis as any).caches.open = vi.fn(async (name: string) => {
      if (name === htdemucsCacheName) return htdemucsMockCache;
      return mockCache;
    });

    // Check caching HT-Demucs into isolated partition
    expect(await isModelCached(htdemucsUrl, htdemucsCacheName)).toBe(false);
    expect((globalThis as any).caches.open).toHaveBeenCalledWith(
      htdemucsCacheName
    );

    htdemucsStore.set(htdemucsUrl, new Response(dummyData.buffer));
    expect(await isModelCached(htdemucsUrl, htdemucsCacheName)).toBe(true);

    // Roformer partition remains unaffected
    expect(await isModelCached(roformerUrl, roformerCacheName)).toBe(false);
  });
});
