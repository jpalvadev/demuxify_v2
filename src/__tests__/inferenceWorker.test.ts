import { describe, it, expect, vi } from "vitest";
import {
  handleWorkerMessage,
  WorkerOutMessage,
  BS_ROFORMER_STEM_ORDER,
} from "../workers/inference.worker";
import { STEM_NAMES } from "../lib/chunkOverlapAdd";
import * as modelCache from "../lib/modelCache";

describe("Inference Engine Worker (Direct Handler Execution)", () => {
  it("runs mock separation end-to-end yielding 4 stems and chunk progress events", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    // 1. Initialize in mock mode
    await handleWorkerMessage({ type: "init", useMock: true }, postMsg);
    expect(postedMessages).toContainEqual({
      type: "init_complete",
      backend: "mock",
    });

    // 2. Start separation on 2-channel audio
    const totalSamples = 88200; // 2 seconds
    const audio = [
      new Float32Array(totalSamples).fill(0.4),
      new Float32Array(totalSamples).fill(0.2),
    ];

    await handleWorkerMessage(
      {
        type: "start",
        audio,
        sampleRate: 44100,
        options: { chunkSamples: 44100, overlapSamples: 4410 },
      },
      postMsg
    );

    // Check that chunk_progress messages were posted
    const chunkEvents = postedMessages.filter(
      (m) => m.type === "chunk_progress"
    );
    expect(chunkEvents.length).toBeGreaterThan(0);
    expect(chunkEvents[0].totalChunks).toBeGreaterThan(0);
    expect(chunkEvents[chunkEvents.length - 1].progress).toBe(1);

    // Check that complete was posted with 4 discrete stems
    const completeEvent = postedMessages.find((m) => m.type === "complete");
    expect(completeEvent).toBeDefined();
    if (completeEvent && completeEvent.type === "complete") {
      expect(completeEvent.duration).toBeCloseTo(2.0);

      for (const stemName of STEM_NAMES) {
        expect(completeEvent.stems[stemName]).toBeDefined();
        expect(completeEvent.stems[stemName].length).toBe(2);
        expect(completeEvent.stems[stemName][0].length).toBe(totalSamples);
        expect(completeEvent.stems[stemName][1].length).toBe(totalSamples);
      }
    }
  });

  it("handles cancellation signal during separation", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    // Send cancel message
    await handleWorkerMessage({ type: "cancel" }, postMsg);

    const cancelledEvent = postedMessages.find((m) => m.type === "cancelled");
    expect(cancelledEvent).toBeDefined();
  });

  it("exports canonical BS_ROFORMER_STEM_ORDER matching domain standards", () => {
    expect(BS_ROFORMER_STEM_ORDER).toEqual([
      "drums",
      "bass",
      "other",
      "vocals",
    ]);
  });

  it("reports BS-RoFormer instead of legacy Demucs in memory error messages", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    vi.spyOn(modelCache, "getModelWeights").mockRejectedValueOnce(
      new Error("RuntimeError: abort(std::bad_alloc)")
    );

    await handleWorkerMessage({ type: "init", useMock: false }, postMsg);

    const errorEvent = postedMessages.find((m) => m.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === "error") {
      expect(errorEvent.error).toContain("BS-RoFormer");
      expect(errorEvent.error).not.toContain("Demucs");
    }
  });

  it("reports dynamic active model profile name and requirements in memory error messages", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    vi.spyOn(modelCache, "getModelWeights").mockRejectedValueOnce(
      new Error("RuntimeError: abort(std::bad_alloc)")
    );

    await handleWorkerMessage(
      { type: "init", modelProfileId: "htdemucs-4stem", useMock: false },
      postMsg
    );

    const errorEvent = postedMessages.find((m) => m.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === "error") {
      expect(errorEvent.error).toContain("HT-Demucs 4-Stem");
      expect(errorEvent.error).toContain("300 MB");
      expect(errorEvent.error).not.toContain("BS-RoFormer");
    }
  });

  it("polymorphic adapter processes HT-Demucs 4-Stem waveform sessions emitting canonical 4 stems", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    const chunkSamples = 88200;
    const fakeDemucsSession: any = {
      inputNames: ["mix"],
      outputNames: ["stems"],
      run: vi.fn(async (feeds: Record<string, any>) => {
        expect(feeds.mix || feeds.input).toBeDefined();
        // Return 4 stems stereo: [1, 4, 2, chunkSamples]
        const outputData = new Float32Array(1 * 4 * 2 * chunkSamples).fill(0.1);
        return {
          stems: {
            data: outputData,
            dims: [1, 4, 2, chunkSamples],
            dispose: vi.fn(),
          },
        };
      }),
    };

    const ort = await import("onnxruntime-web");
    vi.spyOn(ort.InferenceSession, "create").mockResolvedValueOnce(
      fakeDemucsSession
    );
    vi.spyOn(modelCache, "getModelWeights").mockResolvedValueOnce(
      new ArrayBuffer(1024)
    );

    await handleWorkerMessage(
      {
        type: "init",
        modelProfileId: "htdemucs-4stem",
        modelUrl: "/models/htdemucs_4stem_mobile.onnx",
        useMock: false,
      },
      postMsg
    );

    const initComplete = postedMessages.find((m) => m.type === "init_complete");
    expect(initComplete).toBeDefined();

    const audio = [
      new Float32Array(chunkSamples).fill(0.5),
      new Float32Array(chunkSamples).fill(0.5),
    ];

    await handleWorkerMessage(
      {
        type: "start",
        audio,
        sampleRate: 44100,
        options: { chunkSamples, overlapSamples: 4410 },
      },
      postMsg
    );

    const complete = postedMessages.find((m) => m.type === "complete");
    expect(complete).toBeDefined();
    if (complete && complete.type === "complete") {
      expect(complete.stems.vocals).toBeDefined();
      expect(complete.stems.drums).toBeDefined();
      expect(complete.stems.bass).toBeDefined();
      expect(complete.stems.other).toBeDefined();
      expect(complete.stems.vocals[0].length).toBe(chunkSamples);
    }
  });

  it("verifies HT-Demucs polymorphic adapter correctly isolates non-identical stem tracks", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    const chunkSamples = 44100;
    const fakeDemucsSession: any = {
      inputNames: ["mix"],
      outputNames: ["stems"],
      run: vi.fn(async (feeds: Record<string, any>) => {
        expect(feeds.mix || feeds.input).toBeDefined();
        const outputData = new Float32Array(1 * 4 * 2 * chunkSamples);

        // Native HT-Demucs order: [drums, bass, other, vocals]
        // Drums (index 0): 0.25
        outputData.fill(0.25, 0, 2 * chunkSamples);
        // Bass (index 1): 0.15
        outputData.fill(0.15, 2 * chunkSamples, 4 * chunkSamples);
        // Other (index 2): 0.1
        outputData.fill(0.1, 4 * chunkSamples, 6 * chunkSamples);
        // Vocals (index 3): 0.4
        outputData.fill(0.4, 6 * chunkSamples, 8 * chunkSamples);

        return {
          stems: {
            data: outputData,
            dims: [1, 4, 2, chunkSamples],
            dispose: vi.fn(),
          },
        };
      }),
    };

    const ort = await import("onnxruntime-web");
    vi.spyOn(ort.InferenceSession, "create").mockResolvedValueOnce(
      fakeDemucsSession
    );
    vi.spyOn(modelCache, "getModelWeights").mockResolvedValueOnce(
      new ArrayBuffer(1024)
    );

    await handleWorkerMessage(
      {
        type: "init",
        modelProfileId: "htdemucs-4stem",
        modelUrl: "/models/htdemucs_4stem_mobile.onnx",
        useMock: false,
      },
      postMsg
    );

    const audio = [
      new Float32Array(chunkSamples),
      new Float32Array(chunkSamples),
    ];
    for (let i = 0; i < chunkSamples; i++) {
      audio[0][i] = Math.sin(i / 100);
      audio[1][i] = Math.cos(i / 100);
    }

    await handleWorkerMessage(
      {
        type: "start",
        audio,
        sampleRate: 44100,
        options: { chunkSamples, overlapSamples: 4410 },
      },
      postMsg
    );

    const complete = postedMessages.find((m) => m.type === "complete");
    expect(complete).toBeDefined();
    if (complete && complete.type === "complete") {
      const { vocals, drums, bass, other } = complete.stems;
      // Stems must not be identical
      expect(vocals[0][50]).not.toEqual(drums[0][50]);
      expect(vocals[0][50]).not.toEqual(bass[0][50]);
      expect(drums[0][50]).not.toEqual(bass[0][50]);
      expect(bass[0][50]).not.toEqual(other[0][50]);
    }
  });
});
