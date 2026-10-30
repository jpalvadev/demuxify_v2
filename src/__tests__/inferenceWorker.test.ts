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
      { type: "init", modelProfileId: "mdx-net-4stem", useMock: false },
      postMsg
    );

    const errorEvent = postedMessages.find((m) => m.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === "error") {
      expect(errorEvent.error).toContain("MDX-Net 4-Stem");
      expect(errorEvent.error).toContain("300 MB");
      expect(errorEvent.error).not.toContain("BS-RoFormer");
    }
  });
});
