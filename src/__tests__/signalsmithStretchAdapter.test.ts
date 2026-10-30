import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSignalsmithStretchSupported,
  createMultiTrackStretchAdapter,
} from "../lib/signalsmithStretchAdapter";
import { STEM_NAMES, StemName } from "../lib/chunkOverlapAdd";

function createMockAudioContext(hasAudioWorklet = false) {
  const destination = { connect: vi.fn(), disconnect: vi.fn() };
  const mockGain = {
    gain: { value: 1.0, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx: any = {
    currentTime: 0,
    sampleRate: 44100,
    state: "running",
    destination,
    createGain: vi.fn(() => ({ ...mockGain })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      playbackRate: { value: 1.0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBuffer: vi.fn(
      (channels: number, length: number, sampleRate: number) => ({
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: vi.fn(() => new Float32Array(length)),
      })
    ),
  };

  if (hasAudioWorklet) {
    ctx.audioWorklet = {
      addModule: vi.fn().mockResolvedValue(undefined),
    };
  }

  return ctx;
}

describe("Signalsmith Stretch WebAssembly Adapter & Test Fallback", () => {
  const sampleRate = 44100;
  const sampleCount = 44100; // 1s
  const dummyStems: Record<StemName, Float32Array[]> = {
    vocals: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    drums: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    bass: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    other: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Environment Detection", () => {
    it("detects unsupported environments when audioWorklet is absent", () => {
      const mockCtx = createMockAudioContext(false);
      expect(isSignalsmithStretchSupported(mockCtx)).toBe(false);
    });

    it("detects supported environment when audioWorklet and WebAssembly exist", () => {
      const mockCtx = createMockAudioContext(true);
      expect(isSignalsmithStretchSupported(mockCtx)).toBe(true);
    });
  });

  describe("Fallback Adapter (Vitest/JSDOM Test Safe)", () => {
    it("initializes 4 stem channels in fallback mode without crashing", async () => {
      const mockCtx = createMockAudioContext(false);
      const adapter = await createMultiTrackStretchAdapter({
        audioContext: mockCtx,
        sampleRate,
        forceFallback: true,
      });

      expect(adapter.isFallback).toBe(true);
      expect(adapter.getTempo()).toBe(1.0);
      expect(adapter.getPitch()).toBe(0);
      expect(adapter.isFormantPreservationEnabled()).toBe(true);

      for (const stem of STEM_NAMES) {
        expect(adapter.getStemNode(stem)).toBeDefined();
      }
    });

    it("dispatches tempo, pitch, and vocal-only formant settings across all 4 stems", async () => {
      const mockCtx = createMockAudioContext(false);
      const adapter = await createMultiTrackStretchAdapter({
        audioContext: mockCtx,
        sampleRate,
        forceFallback: true,
      });

      adapter.setTempo(1.25);
      expect(adapter.getTempo()).toBe(1.25);

      adapter.setPitch(3);
      expect(adapter.getPitch()).toBe(3);

      // Formant toggle should apply to vocals while drums/bass/other remain direct
      adapter.setFormantPreservation(false);
      expect(adapter.isFormantPreservationEnabled()).toBe(false);

      adapter.setFormantPreservation(true);
      expect(adapter.isFormantPreservationEnabled()).toBe(true);
    });

    it("loads stems and handles transport lifecycle (start, seek, stop, connect, disconnect)", async () => {
      const mockCtx = createMockAudioContext(false);
      const adapter = await createMultiTrackStretchAdapter({
        audioContext: mockCtx,
        sampleRate,
        forceFallback: true,
      });

      await expect(adapter.loadStems(dummyStems)).resolves.not.toThrow();

      const dest = mockCtx.createGain();
      for (const stem of STEM_NAMES) {
        expect(() => adapter.connectStem(stem, dest)).not.toThrow();
      }

      expect(() => adapter.start(0, 0)).not.toThrow();
      expect(() => adapter.seek(0.5)).not.toThrow();
      expect(() => adapter.stop(0)).not.toThrow();
      expect(() => adapter.disconnect()).not.toThrow();
    });
  });

  describe("MultiTrack Signalsmith Node Synchronization & Vocal Formant Rule", () => {
    it("ensures formant preservation is only scheduled on vocals and disabled on drums, bass, and other", async () => {
      // Mock Signalsmith Stretch factory
      const scheduledCalls: Record<StemName, any[]> = {
        vocals: [],
        drums: [],
        bass: [],
        other: [],
      };

      const mockStemNodes: Record<StemName, any> = {
        vocals: {
          schedule: vi.fn((params) => scheduledCalls.vocals.push(params)),
          start: vi.fn(),
          stop: vi.fn(),
          addBuffers: vi.fn().mockResolvedValue(1.0),
          dropBuffers: vi.fn().mockResolvedValue(undefined),
          connect: vi.fn(),
          disconnect: vi.fn(),
        },
        drums: {
          schedule: vi.fn((params) => scheduledCalls.drums.push(params)),
          start: vi.fn(),
          stop: vi.fn(),
          addBuffers: vi.fn().mockResolvedValue(1.0),
          dropBuffers: vi.fn().mockResolvedValue(undefined),
          connect: vi.fn(),
          disconnect: vi.fn(),
        },
        bass: {
          schedule: vi.fn((params) => scheduledCalls.bass.push(params)),
          start: vi.fn(),
          stop: vi.fn(),
          addBuffers: vi.fn().mockResolvedValue(1.0),
          dropBuffers: vi.fn().mockResolvedValue(undefined),
          connect: vi.fn(),
          disconnect: vi.fn(),
        },
        other: {
          schedule: vi.fn((params) => scheduledCalls.other.push(params)),
          start: vi.fn(),
          stop: vi.fn(),
          addBuffers: vi.fn().mockResolvedValue(1.0),
          dropBuffers: vi.fn().mockResolvedValue(undefined),
          connect: vi.fn(),
          disconnect: vi.fn(),
        },
      };

      const mockCtx = createMockAudioContext(true);
      const adapter = await createMultiTrackStretchAdapter({
        audioContext: mockCtx,
        sampleRate,
        customFactory: async (_ctx, stem) => mockStemNodes[stem],
      });

      expect(adapter.isFallback).toBe(false);

      // Set tempo to 1.5x and pitch to +2 semitones with formant preservation active
      adapter.setTempo(1.5);
      adapter.setPitch(2);
      adapter.setFormantPreservation(true);

      // Verify Vocals received formantCompensation: true
      const lastVocalsSchedule =
        scheduledCalls.vocals[scheduledCalls.vocals.length - 1];
      expect(lastVocalsSchedule).toMatchObject({
        rate: 1.5,
        semitones: 2,
        formantCompensation: true,
      });

      // Verify Drums, Bass, Other received formantCompensation: false
      const lastDrumsSchedule =
        scheduledCalls.drums[scheduledCalls.drums.length - 1];
      expect(lastDrumsSchedule).toMatchObject({
        rate: 1.5,
        semitones: 2,
        formantCompensation: false,
      });

      const lastBassSchedule =
        scheduledCalls.bass[scheduledCalls.bass.length - 1];
      expect(lastBassSchedule).toMatchObject({
        rate: 1.5,
        semitones: 2,
        formantCompensation: false,
      });

      const lastOtherSchedule =
        scheduledCalls.other[scheduledCalls.other.length - 1];
      expect(lastOtherSchedule).toMatchObject({
        rate: 1.5,
        semitones: 2,
        formantCompensation: false,
      });

      // When formant preservation is turned off globally, vocals should also get false
      adapter.setFormantPreservation(false);
      const updatedVocalsSchedule =
        scheduledCalls.vocals[scheduledCalls.vocals.length - 1];
      expect(updatedVocalsSchedule.formantCompensation).toBe(false);
    });
  });
});
