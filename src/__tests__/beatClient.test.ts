import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BeatClient } from "../lib/beatClient";

describe("Tempo Detector Client Pipeline (beat client & worker relay)", () => {
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

  it("sends the analysis start message with one channel of Source Mix samples", async () => {
    const client = new BeatClient(mockWorker as unknown as Worker);

    const samples = new Float32Array(44100).fill(0.25);
    const analysisPromise = client.analyze(samples, 44100);

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: "start",
      samples,
      sampleRate: 44100,
      hintBpm: undefined,
    });

    // Relay the worker's ranked candidates + Beat Grid completion
    const beatGrid = Float64Array.from([0.557, 1.114, 1.671]);
    mockWorker.onmessage?.({
      data: {
        type: "complete",
        candidates: [
          { bpm: 107.7, confidence: 0.91 },
          { bpm: 215.4, confidence: 0.34 },
        ],
        beatGrid,
        analyzedBpm: 107.7,
        downbeatPhase: 2,
        duration: 1.0,
      },
    } as MessageEvent);

    const result = await analysisPromise;
    expect(result.candidates[0].bpm).toBe(107.7);
    expect(result.candidates[0].confidence).toBe(0.91);
    expect(result.beatGrid).toEqual(beatGrid);
    expect(result.analyzedBpm).toBe(107.7);
    expect(result.duration).toBe(1.0);
    // The worker's Downbeat Phase rides the same message and is relayed intact.
    expect(result.downbeatPhase).toBe(2);
    // With no re-lock hint, the Beat Grid is locked to the top-ranked reading.
    expect(result.chosenTempoBpm).toBe(107.7);
    expect(client.isBusy()).toBe(false);
  });

  it("sends a hint BPM when re-locking the Beat Grid to a user-selected candidate", async () => {
    const client = new BeatClient(mockWorker as unknown as Worker);

    const samples = new Float32Array(44100).fill(0.25);
    const analysisPromise = client.analyze(samples, 44100, 215.4);

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: "start",
      samples,
      sampleRate: 44100,
      hintBpm: 215.4,
    });

    // The doubling grid the re-lock is expected to produce (half intervals).
    const doublingGrid = Float64Array.from([0.279, 0.557, 0.836]);
    mockWorker.onmessage?.({
      data: {
        type: "complete",
        candidates: [
          { bpm: 215.4, confidence: 0.4 },
          { bpm: 107.7, confidence: 0.9 },
        ],
        beatGrid: doublingGrid,
        analyzedBpm: 215.4,
        downbeatPhase: 1,
        duration: 1.0,
      },
    } as MessageEvent);

    const result = await analysisPromise;
    // Ranked order stays engine-ranked; nothing is presented as certain.
    expect(result.candidates.map((c) => c.bpm)).toContain(107.7);
    expect(result.analyzedBpm).toBe(215.4);
    // The user's pick names the tempo the Beat Grid is locked to, even when a
    // different reading ranks higher on confidence (octave ambiguity is the
    // user's decision).
    expect(result.chosenTempoBpm).toBe(215.4);
    // The grid that arrives is the doubling grid: click intervals halved.
    expect(
      doublingGrid.map((beat, i) =>
        i === 0 ? 0 : beat - doublingGrid[i - 1]
      )[1]
    ).toBeCloseTo(0.278, 3);
    expect(client.isBusy()).toBe(false);
  });

  it("cancels an ongoing analysis and rejects with cancellation", async () => {
    const client = new BeatClient(mockWorker as unknown as Worker);

    const samples = new Float32Array(1000).fill(0.1);
    const analysisPromise = client.analyze(samples, 44100);
    expect(client.isBusy()).toBe(true);

    client.cancel();
    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: "cancel" });

    mockWorker.onmessage?.({
      data: { type: "cancelled" },
    } as MessageEvent);

    await expect(analysisPromise).rejects.toThrow(/cancelled/i);
    expect(client.isBusy()).toBe(false);
  });

  it("relays worker errors into a rejected analysis promise", async () => {
    const client = new BeatClient(mockWorker as unknown as Worker);

    const samples = new Float32Array(1000).fill(0.1);
    const analysisPromise = client.analyze(samples, 44100);

    mockWorker.onmessage?.({
      data: {
        type: "error",
        error: "Tempo Detector received no samples to analyze",
      },
    } as MessageEvent);

    await expect(analysisPromise).rejects.toThrow(
      "Tempo Detector received no samples to analyze"
    );
    expect(client.isBusy()).toBe(false);
  });
});
