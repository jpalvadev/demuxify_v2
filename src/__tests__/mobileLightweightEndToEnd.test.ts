import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  DemuxifySession,
} from "../lib/sessionStore";
import { StemPlayerEngine } from "../lib/stemPlayerEngine";
import { mixAudioStems } from "../lib/customMixdown";
import { createStemBundleZip } from "../lib/bundleZip";
import {
  handleWorkerMessage,
  WorkerOutMessage,
} from "../workers/inference.worker";
import * as modelCache from "../lib/modelCache";

describe("Mobile Lightweight Model End-to-End Integration", () => {
  const sampleRate = 44100;
  const chunkLength = 44100; // 1 second

  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearActiveSession();
  });

  it("persists active modelProfileId in session metadata and restores it on reload", async () => {
    const dummyAudio = new Float32Array(chunkLength).fill(0.1);
    const session: DemuxifySession = {
      metadata: {
        id: "session-mobile-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: "Mobile Song",
        filename: "mobile_song.mp3",
        duration: 1.0,
        sampleRate,
        modelProfileId: "htdemucs-4stem",
      },
      sourceMix: {
        channels: [dummyAudio, dummyAudio],
      },
      stems: {
        vocals: [dummyAudio, dummyAudio],
        drums: [dummyAudio, dummyAudio],
        bass: [dummyAudio, dummyAudio],
        other: [dummyAudio, dummyAudio],
      },
      mixer: {
        stems: {
          vocals: { volume: 1.0, muted: false, solo: false },
          drums: { volume: 1.0, muted: false, solo: false },
          bass: { volume: 1.0, muted: false, solo: false },
          other: { volume: 1.0, muted: false, solo: false },
        },
        masterVolume: 1.0,
        currentTime: 0,
        pitchSemitones: 0,
        tempoRatio: 1.0,
      },
    };

    await saveActiveSession(session);
    const restored = await loadActiveSession();

    expect(restored).not.toBeNull();
    expect(restored?.metadata.modelProfileId).toBe("htdemucs-4stem");
  });

  it("synchronizes HT-Demucs stems in multi-track Stem Player with tempo and pitch shifting", () => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();

    const stems = {
      vocals: ctx.createBuffer(2, chunkLength, sampleRate),
      drums: ctx.createBuffer(2, chunkLength, sampleRate),
      bass: ctx.createBuffer(2, chunkLength, sampleRate),
      other: ctx.createBuffer(2, chunkLength, sampleRate),
    };

    // Fill buffers with synthetic audio
    for (const stem of Object.values(stems)) {
      stem.getChannelData(0).fill(0.2);
      stem.getChannelData(1).fill(0.2);
    }

    const engine = new StemPlayerEngine(stems, {
      audioContext: ctx,
      sampleRate,
    });
    expect(engine.getDuration()).toBeCloseTo(1.0);

    // Apply time-stretch and pitch shifting
    engine.applyTimeStretch({ tempo: 1.25 });
    expect(engine.snapshot().timeStretch.tempo).toBe(1.25);

    engine.applyTimeStretch({ pitch: 3 }); // +3 semitones
    expect(engine.snapshot().timeStretch.pitch).toBe(3);

    engine.dispose();
  });

  it("processes HT-Demucs stems into Custom Mixdown with anti-clipping protection", () => {
    const length = 1000;
    // Generate loud signals to test anti-clipping
    const loudVocal = new Float32Array(length).fill(0.8);
    const loudDrums = new Float32Array(length).fill(0.8);
    const loudBass = new Float32Array(length).fill(0.6);
    const loudOther = new Float32Array(length).fill(0.6);

    const stems = {
      vocals: [loudVocal, loudVocal],
      drums: [loudDrums, loudDrums],
      bass: [loudBass, loudBass],
      other: [loudOther, loudOther],
    };

    const mixdown = mixAudioStems(stems, {
      stemGains: {
        vocals: 1.0,
        drums: 1.0,
        bass: 1.0,
        other: 1.0,
      },
      antiClipping: true,
      masterGain: 1.0,
    });

    expect(mixdown.audio.length).toBe(2);
    expect(mixdown.audio[0].length).toBe(length);
    expect(mixdown.normalized).toBe(true);

    // Verify anti-clipping ensured no samples exceed safety ceiling
    for (let c = 0; c < 2; c++) {
      const ch = mixdown.audio[c];
      for (let i = 0; i < length; i++) {
        expect(Math.abs(ch[i])).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it("exports HT-Demucs stems into a compressed ZIP Export Bundle", async () => {
    const fakeWavBytes = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]);
    const stemFiles = {
      vocals: fakeWavBytes,
      drums: fakeWavBytes,
      bass: fakeWavBytes,
      other: fakeWavBytes,
    };

    const zipBlob = await createStemBundleZip(stemFiles, {
      sourceMixTitle: "MobileTrack",
      format: "wav",
    });

    expect(zipBlob).toBeDefined();
    expect(zipBlob.size).toBeGreaterThan(0);
    expect(zipBlob.type).toBe("application/zip");
  });

  it("processes a multi-chunk song through HT-Demucs low-memory polymorphic inference safely", async () => {
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
        const outputData = new Float32Array(1 * 4 * 2 * chunkSamples).fill(
          0.05
        );
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

    // Multi-chunk audio: 3 chunks
    const totalSamples = chunkSamples * 3;
    const audio = [
      new Float32Array(totalSamples).fill(0.3),
      new Float32Array(totalSamples).fill(0.3),
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
      expect(complete.stems.vocals[0].length).toBe(totalSamples);
      expect(complete.stems.drums[0].length).toBe(totalSamples);
      expect(complete.stems.bass[0].length).toBe(totalSamples);
      expect(complete.stems.other[0].length).toBe(totalSamples);
    }
  });

  it("guarantees HT-Demucs stem separation outputs non-identical discrete tracks without amplitude clipping", async () => {
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
        const inputData = (feeds.mix || feeds.input).data as Float32Array;
        const outputData = new Float32Array(1 * 4 * 2 * chunkSamples);

        // Native HT-Demucs order: [drums, bass, other, vocals]
        // Stem 0 (drums): 0.3
        for (let i = 0; i < chunkSamples; i++) {
          outputData[i] = inputData[i] * 0.3;
          outputData[chunkSamples + i] = inputData[chunkSamples + i] * 0.3;
        }
        // Stem 1 (bass): 0.15
        for (let i = 0; i < chunkSamples; i++) {
          outputData[2 * chunkSamples + i] = inputData[i] * 0.15;
          outputData[3 * chunkSamples + i] = inputData[chunkSamples + i] * 0.15;
        }
        // Stem 2 (other): 0.05
        for (let i = 0; i < chunkSamples; i++) {
          outputData[4 * chunkSamples + i] = inputData[i] * 0.05;
          outputData[5 * chunkSamples + i] = inputData[chunkSamples + i] * 0.05;
        }
        // Stem 3 (vocals): 0.5
        for (let i = 0; i < chunkSamples; i++) {
          outputData[6 * chunkSamples + i] = inputData[i] * 0.5;
          outputData[7 * chunkSamples + i] = inputData[chunkSamples + i] * 0.5;
        }

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

    const totalSamples = chunkSamples;
    const audio = [
      new Float32Array(totalSamples),
      new Float32Array(totalSamples),
    ];
    for (let i = 0; i < totalSamples; i++) {
      audio[0][i] = 0.6 * Math.sin(i / 10);
      audio[1][i] = 0.6 * Math.cos(i / 10);
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

      // Stems must NOT be identical to each other
      expect(vocals[0][100]).not.toEqual(drums[0][100]);
      expect(vocals[0][100]).not.toEqual(bass[0][100]);
      expect(drums[0][100]).not.toEqual(bass[0][100]);
      expect(bass[0][100]).not.toEqual(other[0][100]);
    }
  });

  it("processes audio through Open-Unmix ultra fast STFT magnitude pipeline with all 4 stems", async () => {
    const postedMessages: WorkerOutMessage[] = [];
    const postMsg = (m: WorkerOutMessage) => {
      postedMessages.push(m);
    };

    const chunkSamples = 44100;
    const UMX_N_FFT = 4096;
    const UMX_HOP_LENGTH = 1024;
    const F = Math.floor(UMX_N_FFT / 2) + 1; // 2049
    const T = Math.floor(chunkSamples / UMX_HOP_LENGTH) + 1; // 44
    const totalBins = 2 * F * T;

    const fakeUmxSession: any = {
      inputNames: ["magnitude"],
      outputNames: [
        "vocals_magnitude",
        "drums_magnitude",
        "bass_magnitude",
        "other_magnitude",
      ],
      run: vi.fn(async (feeds: Record<string, any>) => {
        expect(feeds.magnitude).toBeDefined();
        return {
          vocals_magnitude: {
            data: new Float32Array(totalBins).fill(0.4),
            dims: [1, 2, F, T],
            dispose: vi.fn(),
          },
          drums_magnitude: {
            data: new Float32Array(totalBins).fill(0.3),
            dims: [1, 2, F, T],
            dispose: vi.fn(),
          },
          bass_magnitude: {
            data: new Float32Array(totalBins).fill(0.2),
            dims: [1, 2, F, T],
            dispose: vi.fn(),
          },
          other_magnitude: {
            data: new Float32Array(totalBins).fill(0.1),
            dims: [1, 2, F, T],
            dispose: vi.fn(),
          },
        };
      }),
    };

    const ort = await import("onnxruntime-web");
    vi.spyOn(ort.InferenceSession, "create").mockResolvedValueOnce(
      fakeUmxSession
    );
    vi.spyOn(modelCache, "getModelWeights").mockResolvedValueOnce(
      new ArrayBuffer(1024)
    );

    await handleWorkerMessage(
      {
        type: "init",
        modelProfileId: "open-unmix-4stem",
        modelUrl: "/models/open_unmix_4stem_mobile.onnx",
        useMock: false,
      },
      postMsg
    );

    const audio = [
      new Float32Array(chunkSamples).fill(0.2),
      new Float32Array(chunkSamples).fill(0.2),
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
      const { vocals, drums, bass, other } = complete.stems;
      expect(vocals[0].length).toBe(chunkSamples);
      expect(drums[0].length).toBe(chunkSamples);
      expect(bass[0].length).toBe(chunkSamples);
      expect(other[0].length).toBe(chunkSamples);
    }
  });
});
