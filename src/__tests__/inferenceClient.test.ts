import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InferenceClient } from '../lib/inferenceClient';
import { STEM_NAMES, StemName } from '../lib/chunkOverlapAdd';

describe('Inference Client & Engine Pipeline', () => {
  let mockWorker: {
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
  };

  beforeEach(() => {
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes the model and relays download progress events', async () => {
    const client = new InferenceClient(mockWorker as unknown as Worker);

    const downloadEvents: any[] = [];
    const initPromise = client.init({
      modelUrl: 'https://example.com/model.onnx',
      onDownloadProgress: (p) => downloadEvents.push(p),
    });

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'init',
      modelUrl: 'https://example.com/model.onnx',
      useMock: false,
    });

    // Simulate worker emitting download progress
    mockWorker.onmessage?.({
      data: {
        type: 'download_progress',
        loadedBytes: 50,
        totalBytes: 100,
        progress: 0.5,
      },
    } as MessageEvent);

    // Simulate worker finishing init
    mockWorker.onmessage?.({
      data: {
        type: 'init_complete',
        backend: 'webgpu',
      },
    } as MessageEvent);

    const result = await initPromise;
    expect(result.backend).toBe('webgpu');
    expect(downloadEvents).toEqual([
      { loadedBytes: 50, totalBytes: 100, progress: 0.5 },
    ]);
  });

  it('processes separation with chunk progress reporting and returns 4 stems', async () => {
    const client = new InferenceClient(mockWorker as unknown as Worker);

    const chunkEvents: any[] = [];
    const totalSamples = 44100;
    const audio = [new Float32Array(totalSamples), new Float32Array(totalSamples)];

    const separationPromise = client.separate(audio, 44100, {
      onChunkProgress: (p) => chunkEvents.push(p),
    });

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'start',
      audio,
      sampleRate: 44100,
      options: undefined,
    });

    // Simulate worker chunk progress
    mockWorker.onmessage?.({
      data: {
        type: 'chunk_progress',
        chunkIndex: 0,
        totalChunks: 2,
        progress: 0.5,
        elapsedMs: 1200,
        etaMs: 1200,
      },
    } as MessageEvent);

    expect(chunkEvents.length).toBe(1);
    expect(chunkEvents[0]).toEqual({
      chunkIndex: 0,
      totalChunks: 2,
      progress: 0.5,
      elapsedMs: 1200,
      etaMs: 1200,
    });

    // Simulate worker completion with 4 stems
    const mockStems: Record<StemName, Float32Array[]> = {
      vocals: [new Float32Array(totalSamples), new Float32Array(totalSamples)],
      drums: [new Float32Array(totalSamples), new Float32Array(totalSamples)],
      bass: [new Float32Array(totalSamples), new Float32Array(totalSamples)],
      other: [new Float32Array(totalSamples), new Float32Array(totalSamples)],
    };

    mockWorker.onmessage?.({
      data: {
        type: 'complete',
        stems: mockStems,
        duration: 1.0,
      },
    } as MessageEvent);

    const result = await separationPromise;
    expect(result.stems).toBeDefined();
    for (const stem of STEM_NAMES) {
      expect(result.stems[stem].length).toBe(2);
      expect(result.stems[stem][0].length).toBe(totalSamples);
    }
  });

  it('cancels ongoing separation and rejects pending separation promise with cancellation', async () => {
    const client = new InferenceClient(mockWorker as unknown as Worker);

    const audio = [new Float32Array(1000), new Float32Array(1000)];
    const separationPromise = client.separate(audio, 44100);

    // Call cancel
    client.cancel();
    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'cancel' });

    // Worker acknowledges cancellation
    mockWorker.onmessage?.({
      data: {
        type: 'cancelled',
      },
    } as MessageEvent);

    await expect(separationPromise).rejects.toThrow(/cancelled/i);
    expect(client.isBusy()).toBe(false);
  });

  it('handles worker errors during separation', async () => {
    const client = new InferenceClient(mockWorker as unknown as Worker);

    const audio = [new Float32Array(1000), new Float32Array(1000)];
    const separationPromise = client.separate(audio, 44100);

    mockWorker.onmessage?.({
      data: {
        type: 'error',
        error: 'Out of WebGPU memory',
      },
    } as MessageEvent);

    await expect(separationPromise).rejects.toThrow('Out of WebGPU memory');
    expect(client.isBusy()).toBe(false);
  });
});
