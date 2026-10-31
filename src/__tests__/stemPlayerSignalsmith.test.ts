import { describe, it, expect, vi, beforeEach } from "vitest";
import { StemPlayerEngine } from "../lib/stemPlayerEngine";
import { StemName } from "../lib/chunkOverlapAdd";
import { MultiTrackStretchNode } from "../lib/signalsmithStretchAdapter";

function createMockAudioContext() {
  let currentTime = 10.0;
  return {
    get currentTime() {
      return currentTime;
    },
    set currentTime(t: number) {
      currentTime = t;
    },
    sampleRate: 44100,
    state: "running" as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => ({
      gain: { value: 1.0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      playbackRate: { value: 1.0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBuffer: vi.fn(
      (channels: number, length: number, sampleRate: number) => {
        const channelArrays = Array.from(
          { length: channels },
          () => new Float32Array(length)
        );
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: vi.fn((ch: number) => channelArrays[ch]),
        };
      }
    ),
  };
}

function createMockStretchAdapter(): MultiTrackStretchNode {
  let currentTempo = 1.0;
  let currentPitch = 0;
  let formantEnabled = true;

  const stemGainNodes: Record<StemName, any> = {
    vocals: { connect: vi.fn(), disconnect: vi.fn() },
    drums: { connect: vi.fn(), disconnect: vi.fn() },
    bass: { connect: vi.fn(), disconnect: vi.fn() },
    other: { connect: vi.fn(), disconnect: vi.fn() },
  };

  return {
    isFallback: false,
    getStemNode: vi.fn((stem: StemName) => stemGainNodes[stem]),
    loadStems: vi.fn().mockResolvedValue(undefined),
    setTempo: vi.fn((rate: number) => {
      currentTempo = rate;
    }),
    setPitch: vi.fn((semitones: number) => {
      currentPitch = semitones;
    }),
    setFormantPreservation: vi.fn((enabled: boolean) => {
      formantEnabled = enabled;
    }),
    start: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    connectStem: vi.fn(),
    disconnect: vi.fn(),
    getTempo: vi.fn(() => currentTempo),
    getPitch: vi.fn(() => currentPitch),
    isFormantPreservationEnabled: vi.fn(() => formantEnabled),
  };
}

describe("Stem Player Multi-Track Signalsmith Stretch Integration", () => {
  let mockCtx: any;
  const sampleRate = 44100;
  const sampleCount = 44100 * 5; // 5s

  const dummyStems: Record<StemName, Float32Array[]> = {
    vocals: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    drums: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    bass: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    other: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
  };

  beforeEach(() => {
    mockCtx = createMockAudioContext();
  });

  it("connects live playback through 4-stem Signalsmith Stretch processing nodes", async () => {
    const mockAdapter = createMockStretchAdapter();
    const engine = new StemPlayerEngine(dummyStems, {
      audioContext: mockCtx,
      sampleRate,
      stretchAdapter: mockAdapter,
    });

    expect(engine.isUsingWorklet()).toBe(true);
    expect(engine.getStretchAdapter()).toBe(mockAdapter);

    await engine.play();
    expect(mockAdapter.start).toHaveBeenCalledWith(10.0, 0);

    engine.pause();
    expect(mockAdapter.stop).toHaveBeenCalled();
  });

  it("dispatches quantized tempo, pitch, and vocal formant preservation to the adapter", () => {
    const mockAdapter = createMockStretchAdapter();
    const engine = new StemPlayerEngine(dummyStems, {
      audioContext: mockCtx,
      sampleRate,
      stretchAdapter: mockAdapter,
    });

    // Tempo stepping (0.05x grid; engine accepts any clamped value)
    engine.setTempo(1.25);
    expect(mockAdapter.setTempo).toHaveBeenCalledWith(1.25);
    expect(engine.getTempo()).toBe(1.25);
    engine.setTempo(1.35);
    expect(mockAdapter.setTempo).toHaveBeenCalledWith(1.35);
    expect(engine.getTempo()).toBe(1.35);

    // Pitch stepping (1 semitone)
    engine.setPitch(3);
    expect(mockAdapter.setPitch).toHaveBeenCalledWith(3);
    expect(engine.getPitch()).toBe(3);

    // Vocal Formant Preservation toggle
    expect(engine.isFormantPreservationEnabled()).toBe(true);
    engine.setFormantPreservation(false);
    expect(mockAdapter.setFormantPreservation).toHaveBeenCalledWith(false);
    expect(engine.isFormantPreservationEnabled()).toBe(false);

    engine.setFormantPreservation(true);
    expect(mockAdapter.setFormantPreservation).toHaveBeenCalledWith(true);
    expect(engine.isFormantPreservationEnabled()).toBe(true);
  });

  it("anchors canonical duration while playhead advances proportionally to active tempo", async () => {
    const mockAdapter = createMockStretchAdapter();
    const engine = new StemPlayerEngine(dummyStems, {
      audioContext: mockCtx,
      sampleRate,
      stretchAdapter: mockAdapter,
    });

    // Original duration remains 5 seconds
    expect(engine.getDuration()).toBe(5.0);

    // Start playback at 2.0x tempo
    engine.setTempo(2.0);
    await engine.play();

    // Advance real time by 1.0s (10.0 -> 11.0)
    mockCtx.currentTime = 11.0;

    // At 2.0x tempo, 1.0 real second translates to 2.0 source seconds
    expect(engine.getCurrentTime()).toBeCloseTo(2.0, 2);
    expect(engine.getDuration()).toBe(5.0); // Duration unchanged

    // Seeking to 3.5s
    engine.seek(3.5);
    expect(mockAdapter.seek).toHaveBeenCalledWith(3.5);
    expect(engine.getCurrentTime()).toBe(3.5);
  });
});
