import { describe, it, expect } from "vitest";
import {
  handleWorkerMessage,
  WorkerOutMessage,
} from "../workers/beatDetection.worker";

describe("Tempo Detector Worker (Direct Handler Execution)", () => {
  // Test double (allowed per CODING_STANDARDS §4): deterministic synthetic
  // 107.7 BPM pulse surrogate standing in for the librosa ground-truth anchor
  // verified by scripts/check_bpm.py (107.7 BPM / 503 beats / 0.557 s median
  // interval on the 294.1 s reference Source Mix).
  const makePulseChannel = (bpm: number, durationSec: number, fs: number) => {
    const total = Math.round(durationSec * fs);
    const out = new Float32Array(total);
    const period = (60 / bpm) * fs;
    const tapLen = Math.round(0.012 * fs);
    for (let b = 1; b * period < total - fs * 0.05; b++) {
      const start = Math.round(b * period);
      for (let i = 0; i < tapLen && start + i < total; i++) {
        const env = Math.exp((-8 * i) / tapLen);
        out[start + i] += Math.sin((2 * Math.PI * 220 * i) / fs) * env * 0.9;
      }
    }
    return out;
  };

  const medianInterval = (beats: Float64Array) => {
    const diffs: number[] = [];
    for (let i = 0; i + 1 < beats.length; i++)
      diffs.push(beats[i + 1] - beats[i]);
    diffs.sort();
    return diffs.length ? diffs[Math.floor(diffs.length / 2)] : 0;
  };

  it("runs the analysis pass yielding ranked BPM candidates near the librosa anchor and a Beat Grid", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    const fs = 44100;
    const surrogateBpm = 107.7;
    const durationSec = 12;
    const samples = makePulseChannel(surrogateBpm, durationSec, fs);

    await handleWorkerMessage(
      { type: "start", samples, sampleRate: fs },
      postMsg
    );

    const complete = postedMessages.find((m) => m.type === "complete");
    expect(complete).toBeDefined();
    if (complete && complete.type === "complete") {
      // Engine only ranks; the top reading must sit within the octave-tolerant
      // ±5% window of the librosa anchor.
      const top = complete.candidates[0];
      expect(Math.abs(top.bpm - 107.7) / 107.7).toBeLessThanOrEqual(0.05);
      expect(top.confidence).toBeGreaterThanOrEqual(0);
      expect(top.confidence).toBeLessThanOrEqual(1);

      // Ranked alternatives must be surfaced, never silently collapsed.
      expect(complete.candidates.length).toBeGreaterThanOrEqual(2);

      // Beat Grid: positions in seconds, monotonically increasing, spacing at
      // the anchor interval (~0.557 s at 107.7 BPM) within 10%.
      const expectedInterval = 60 / 107.7;
      const beats = complete.beatGrid;
      expect(beats.length).toBeGreaterThan(1);
      for (let i = 0; i + 1 < beats.length; i++) {
        expect(beats[i + 1]).toBeGreaterThan(beats[i]);
      }
      expect(
        Math.abs(medianInterval(beats) - expectedInterval)
      ).toBeLessThanOrEqual(expectedInterval * 0.1);

      // Grid size sanity: one beat per beat-interval over the analyzed window.
      const expectedBeats = (durationSec * complete.analyzedBpm) / 60;
      expect(Math.abs(beats.length - expectedBeats)).toBeLessThanOrEqual(2);

      expect(complete.duration).toBeCloseTo(durationSec);

      // ADR-0011: the completion carries the automatic Downbeat Phase, always
      // a beat index inside the lane's default grouping.
      expect(Number.isInteger(complete.downbeatPhase)).toBe(true);
      expect(complete.downbeatPhase).toBeGreaterThanOrEqual(0);
      expect(complete.downbeatPhase).toBeLessThan(4);
      // The surrogate pulse lattice starts one beat into the grid (makePulseChannel
      // taps from b=1), so beat 0 hears no attack: the prominence reading
      // deterministically marks the first attacked beat as the Downbeat.
      expect(complete.downbeatPhase).toBe(1);
    }
  });

  it("scores the Downbeat Phase against the analyzed channel: a planted bar-head accent moves it", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    const fs = 44100;
    // Same surrogate, but every fourth attack from index 2 on is the loud one:
    // a bar head planted two beats into the pulse indexing.
    const period = (60 / 107.7) * fs;
    const total = Math.round(12 * fs);
    const samples = new Float32Array(total);
    const tapLen = Math.round(0.012 * fs);
    let plantedStrong: number[] = [];
    for (let b = 1; b * period < total - fs * 0.05; b++) {
      const start = Math.round(b * period);
      const loud = b % 4 === 2;
      if (loud) plantedStrong.push(start / fs);
      const amp = loud ? 1.4 : 0.4;
      for (let i = 0; i < tapLen && start + i < total; i++) {
        const env = Math.exp((-8 * i) / tapLen);
        samples[start + i] +=
          Math.sin((2 * Math.PI * 220 * i) / fs) * env * amp;
      }
    }

    await handleWorkerMessage(
      { type: "start", samples, sampleRate: fs },
      postMsg
    );

    const complete = postedMessages.find((m) => m.type === "complete");
    expect(complete).toBeDefined();
    if (complete && complete.type === "complete") {
      const beats = complete.beatGrid;
      // Without copying the scoring into the test: the grid beat nearest the
      // first planted accent names its index, and the phase must claim exactly
      // that index as the Downbeat.
      const firstAccent = plantedStrong[0];
      let nearest = 0;
      for (let k = 1; k < beats.length; k++) {
        if (
          Math.abs(beats[k] - firstAccent) <
          Math.abs(beats[nearest] - firstAccent)
        )
          nearest = k;
      }
      expect(complete.downbeatPhase).toBe(nearest % 4);

      // The reading is a pure function of (grid, channel): a re-run agrees.
      const again = postedMessages.filter((m) => m.type === "complete").length;
      expect(again).toBe(1);
      await handleWorkerMessage(
        { type: "start", samples, sampleRate: fs },
        postMsg
      );
      const reruns = postedMessages.filter((m) => m.type === "complete");
      expect(reruns[reruns.length - 1].downbeatPhase).toBe(
        reruns[reruns.length - 2].downbeatPhase
      );
    }
  });

  it("re-locks the Beat Grid to a hint BPM candidate (metric doubling halves the interval)", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    const fs = 44100;
    const samples = makePulseChannel(107.7, 12, fs);

    await handleWorkerMessage(
      { type: "start", samples, sampleRate: fs, hintBpm: 215.4 },
      postMsg
    );

    const complete = postedMessages.find((m) => m.type === "complete");
    expect(complete).toBeDefined();
    if (complete && complete.type === "complete") {
      const beats = complete.beatGrid;
      const expectedInterval = 60 / 215.4;
      // ~0.557 s → ~0.279 s: clicks move to the other metric level.
      expect(
        Math.abs(medianInterval(beats) - expectedInterval)
      ).toBeLessThanOrEqual(expectedInterval * 0.1);
    }
  });

  it("handles a cancellation signal from the client", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    await handleWorkerMessage({ type: "cancel" }, postMsg);

    const cancelledEvent = postedMessages.find((m) => m.type === "cancelled");
    expect(cancelledEvent).toBeDefined();
  });

  it("reports an error message for empty sample input", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    await handleWorkerMessage(
      { type: "start", samples: new Float32Array(0), sampleRate: 44100 },
      postMsg
    );

    const errorEvent = postedMessages.find((m) => m.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === "error") {
      expect(errorEvent.error).toContain("no samples");
    }
  });
});
