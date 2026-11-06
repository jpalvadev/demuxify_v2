import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createSeparationEngine,
  SeparationEngine,
  SeparationError,
  SeparationProgressEvent,
} from "../lib/separationEngine";
import { STEM_NAMES, StemName } from "../lib/chunkOverlapAdd";

describe("Separation Engine Core & Telemetry Seam", () => {
  let mockWorker: {
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
  };

  const createMockWorker = () => {
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };
    return mockWorker as unknown as Worker;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("orchestrates successful end-to-end separation with ordered telemetry progression", async () => {
    const engine: SeparationEngine = createSeparationEngine({
      workerFactory: createMockWorker,
    });

    const progressEvents: SeparationProgressEvent[] = [];
    const totalSamples = 44100;
    const rawAudio = {
      channels: [
        new Float32Array(totalSamples),
        new Float32Array(totalSamples),
      ],
      sampleRate: 44100,
    };

    const separationPromise = engine.separate(
      {
        source: rawAudio,
        modelProfileId: "bs-roformer-4stem",
      },
      {
        onProgress: (p) => progressEvents.push(p),
      }
    );

    // 1. Worker should receive "init" message
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "init",
        modelProfileId: "bs-roformer-4stem",
      })
    );

    // 2. Worker emits download progress
    mockWorker.onmessage?.({
      data: {
        type: "download_progress",
        loadedBytes: 50 * 1024 * 1024,
        totalBytes: 100 * 1024 * 1024,
        progress: 0.5,
      },
    } as MessageEvent);

    // 3. Worker finishes initialization
    mockWorker.onmessage?.({
      data: {
        type: "init_complete",
        backend: "webgpu",
      },
    } as MessageEvent);

    // 4. Engine should immediately send "start" with extracted channels
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "start",
        sampleRate: 44100,
      })
    );

    // 5. Worker emits chunk_start
    mockWorker.onmessage?.({
      data: {
        type: "chunk_start",
        chunkIndex: 0,
        totalChunks: 2,
        stage: "webgpu_compiling",
      },
    } as MessageEvent);

    // 6. Worker emits chunk_progress
    mockWorker.onmessage?.({
      data: {
        type: "chunk_progress",
        chunkIndex: 0,
        totalChunks: 2,
        progress: 0.5,
        elapsedMs: 2500,
        etaMs: 2500,
      },
    } as MessageEvent);

    // 7. Worker emits complete
    const mockStems: Record<StemName, Float32Array[]> = {
      vocals: [new Float32Array(totalSamples), new Float32Array(totalSamples)],
      drums: [new Float32Array(totalSamples), new Float32Array(totalSamples)],
      bass: [new Float32Array(totalSamples), new Float32Array(totalSamples)],
      other: [new Float32Array(totalSamples), new Float32Array(totalSamples)],
    };

    mockWorker.onmessage?.({
      data: {
        type: "complete",
        stems: mockStems,
        duration: 1.0,
      },
    } as MessageEvent);

    const result = await separationPromise;

    expect(result.duration).toBe(1.0);
    expect(result.sampleRate).toBe(44100);
    expect(result.modelProfileId).toBe("bs-roformer-4stem");
    expect(result.backend).toBe("webgpu");
    for (const stem of STEM_NAMES) {
      expect(result.stems[stem]).toBeDefined();
      expect(result.stems[stem].length).toBe(2);
    }

    // Verify telemetry order: downloading -> initializing -> separating (chunk_start) -> separating (chunk_progress)
    expect(progressEvents.length).toBe(4);
    expect(progressEvents[0].stage).toBe("downloading");
    expect(progressEvents[1].stage).toBe("initializing");
    expect(progressEvents[2].stage).toBe("separating");
    expect(progressEvents[3].stage).toBe("separating");
    if (progressEvents[3].stage === "separating") {
      expect(progressEvents[3].elapsedMs).toBe(2500);
      expect(progressEvents[3].etaMs).toBe(2500);
    }
  });

  it("supports polymorphic AudioBuffer input extraction", async () => {
    const engine = createSeparationEngine({
      workerFactory: createMockWorker,
    });

    const channel0 = new Float32Array(8000);
    const channel1 = new Float32Array(8000);
    channel0[0] = 0.42;

    const mockAudioBuffer = {
      numberOfChannels: 2,
      sampleRate: 48000,
      duration: 8000 / 48000,
      getChannelData: (ch: number) => (ch === 0 ? channel0 : channel1),
    } as unknown as AudioBuffer;

    const separationPromise = engine.separate({
      source: mockAudioBuffer,
      modelProfileId: "open-unmix-4stem",
    });

    // Worker completes init
    mockWorker.onmessage?.({
      data: {
        type: "init_complete",
        backend: "wasm",
      },
    } as MessageEvent);

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: "start",
      audio: [channel0, channel1],
      sampleRate: 48000,
    });

    mockWorker.onmessage?.({
      data: {
        type: "complete",
        stems: {
          vocals: [channel0, channel1],
          drums: [channel0, channel1],
          bass: [channel0, channel1],
          other: [channel0, channel1],
        },
        duration: 8000 / 48000,
      },
    } as MessageEvent);

    const result = await separationPromise;
    expect(result.sampleRate).toBe(48000);
    expect(result.backend).toBe("wasm");
    expect(result.modelProfileId).toBe("open-unmix-4stem");
  });

  it("reuses the active worker and compiled session across consecutive runs with matching profile", async () => {
    let workerInstantiations = 0;
    const engine = createSeparationEngine({
      workerFactory: () => {
        workerInstantiations++;
        return createMockWorker();
      },
    });

    const source = {
      channels: [new Float32Array(1000), new Float32Array(1000)],
      sampleRate: 44100,
    };

    // First separation run with bs-roformer
    const p1 = engine.separate({
      source,
      modelProfileId: "bs-roformer-4stem",
    });

    expect(workerInstantiations).toBe(1);
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "init",
        modelProfileId: "bs-roformer-4stem",
      })
    );

    mockWorker.onmessage?.({
      data: { type: "init_complete", backend: "webgpu" },
    } as MessageEvent);

    mockWorker.onmessage?.({
      data: {
        type: "complete",
        stems: {
          vocals: source.channels,
          drums: source.channels,
          bass: source.channels,
          other: source.channels,
        },
        duration: 1.0,
      },
    } as MessageEvent);

    await p1;
    mockWorker.postMessage.mockClear();

    // Second separation run with SAME profile
    const p2 = engine.separate({
      source,
      modelProfileId: "bs-roformer-4stem",
    });

    // Should NOT instantiate another worker
    expect(workerInstantiations).toBe(1);
    // Should NOT send "init" again — goes straight to "start"!
    expect(mockWorker.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "init" })
    );
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "start" })
    );

    mockWorker.onmessage?.({
      data: {
        type: "complete",
        stems: {
          vocals: source.channels,
          drums: source.channels,
          bass: source.channels,
          other: source.channels,
        },
        duration: 1.0,
      },
    } as MessageEvent);

    await p2;
    mockWorker.postMessage.mockClear();

    // Third separation run with DIFFERENT profile (htdemucs-4stem)
    const p3 = engine.separate({
      source,
      modelProfileId: "htdemucs-4stem",
    });

    // Re-initializes for the new profile
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "init",
        modelProfileId: "htdemucs-4stem",
      })
    );

    mockWorker.onmessage?.({
      data: { type: "init_complete", backend: "wasm" },
    } as MessageEvent);

    mockWorker.onmessage?.({
      data: {
        type: "complete",
        stems: {
          vocals: source.channels,
          drums: source.channels,
          bass: source.channels,
          other: source.channels,
        },
        duration: 1.0,
      },
    } as MessageEvent);

    const r3 = await p3;
    expect(r3.modelProfileId).toBe("htdemucs-4stem");
  });

  it("aborts processing cleanly upon receiving an AbortSignal", async () => {
    const engine = createSeparationEngine({
      workerFactory: createMockWorker,
    });

    const controller = new AbortController();
    const source = {
      channels: [new Float32Array(1000), new Float32Array(1000)],
      sampleRate: 44100,
    };

    const separationPromise = engine.separate(
      { source },
      { signal: controller.signal }
    );

    mockWorker.onmessage?.({
      data: { type: "init_complete", backend: "webgpu" },
    } as MessageEvent);

    // Abort mid-flight
    controller.abort();

    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: "cancel" });

    await expect(separationPromise).rejects.toThrow();
    await expect(separationPromise).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("rejects immediately if AbortSignal is already aborted", async () => {
    const engine = createSeparationEngine({
      workerFactory: createMockWorker,
    });

    const controller = new AbortController();
    controller.abort();

    const source = {
      channels: [new Float32Array(1000), new Float32Array(1000)],
      sampleRate: 44100,
    };

    await expect(
      engine.separate({ source }, { signal: controller.signal })
    ).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(mockWorker.postMessage).not.toHaveBeenCalled();
  });

  it("maps worker errors into structured domain SeparationError instances", async () => {
    const engine = createSeparationEngine({
      workerFactory: createMockWorker,
    });

    const source = {
      channels: [new Float32Array(1000), new Float32Array(1000)],
      sampleRate: 44100,
    };

    // 1. OOM error
    const pOOM = engine.separate({ source });
    mockWorker.onmessage?.({
      data: {
        type: "error",
        error:
          "std::bad_alloc: WASM heap memory exhausted while allocating buffer",
      },
    } as MessageEvent);

    await expect(pOOM).rejects.toBeInstanceOf(SeparationError);
    await expect(pOOM).rejects.toMatchObject({
      code: "OOM",
    });

    // 2. Backend unavailable error
    const pBackend = engine.separate({ source });
    mockWorker.onmessage?.({
      data: {
        type: "error",
        error: "Failed to request WebGPU device adapter: WebGPU not supported",
      },
    } as MessageEvent);

    await expect(pBackend).rejects.toBeInstanceOf(SeparationError);
    await expect(pBackend).rejects.toMatchObject({
      code: "BACKEND_UNAVAILABLE",
    });

    // 3. Model load error
    const pModel = engine.separate({ source });
    mockWorker.onmessage?.({
      data: {
        type: "error",
        error: "Failed to fetch model weights from network: 404 Not Found",
      },
    } as MessageEvent);

    await expect(pModel).rejects.toBeInstanceOf(SeparationError);
    await expect(pModel).rejects.toMatchObject({
      code: "MODEL_LOAD_FAILED",
    });

    // 4. Generic inference failure
    const pInference = engine.separate({ source });
    mockWorker.onmessage?.({
      data: {
        type: "error",
        error: "Tensor dimension mismatch on node Add_42",
      },
    } as MessageEvent);

    await expect(pInference).rejects.toBeInstanceOf(SeparationError);
    await expect(pInference).rejects.toMatchObject({
      code: "INFERENCE_FAILED",
    });
  });

  it("handles worker onerror crash gracefully", async () => {
    const engine = createSeparationEngine({
      workerFactory: createMockWorker,
    });

    const source = {
      channels: [new Float32Array(1000), new Float32Array(1000)],
      sampleRate: 44100,
    };

    const promise = engine.separate({ source });

    mockWorker.onerror?.({
      message: "Uncaught Out of Memory error in worker thread",
    } as ErrorEvent);

    await expect(promise).rejects.toBeInstanceOf(SeparationError);
    await expect(promise).rejects.toMatchObject({
      code: "OOM",
    });
  });

  it("prevents concurrent separation tasks on the same engine instance", async () => {
    const engine = createSeparationEngine({
      workerFactory: createMockWorker,
    });

    const source = {
      channels: [new Float32Array(1000), new Float32Array(1000)],
      sampleRate: 44100,
    };

    const p1 = engine.separate({ source });

    await expect(engine.separate({ source })).rejects.toMatchObject({
      code: "INFERENCE_FAILED",
      message: expect.stringContaining("already processing"),
    });

    // Clean up p1
    mockWorker.onmessage?.({
      data: {
        type: "complete",
        stems: {
          vocals: source.channels,
          drums: source.channels,
          bass: source.channels,
          other: source.channels,
        },
        duration: 1.0,
      },
    } as MessageEvent);
    await p1;
  });

  it("terminates worker and cancels active promises on dispose()", async () => {
    const engine = createSeparationEngine({
      workerFactory: createMockWorker,
    });

    const source = {
      channels: [new Float32Array(1000), new Float32Array(1000)],
      sampleRate: 44100,
    };

    const p = engine.separate({ source });
    expect(mockWorker.terminate).not.toHaveBeenCalled();

    engine.dispose();

    expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
    await expect(p).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
