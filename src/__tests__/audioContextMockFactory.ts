// Shared AudioContext mock (CODING_STANDARDS rule 8: one module, every seam
// imports it instead of hand-copying the shape). `time0` is the fixture's
// time origin: anchor assertions pin source.start(when, offset) arguments
// against it (UI seams: 0; headless engine anchor seams: 10.0).
// `createdSources` records every BufferSource with its start/stop spies so
// lane-anchor tests can read the recorded arguments without reaching into the
// engine's graph.
import { vi } from "vitest";

export function createMockAudioContext(time0: number = 0) {
  let currentTime = time0;

  const createdSources: any[] = [];

  const createGain = vi.fn(() => {
    const gainNode = {
      gain: {
        value: 1.0,
        setValueAtTime: vi.fn((val: number) => {
          gainNode.gain.value = val;
        }),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    return gainNode;
  });

  const createBufferSource = vi.fn(() => {
    const sourceNode = {
      buffer: null as any,
      playbackRate: {
        value: 1.0,
        setValueAtTime: vi.fn((rate: number) => {
          sourceNode.playbackRate.value = rate;
        }),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as any,
    };
    createdSources.push(sourceNode);
    return sourceNode;
  });

  const createBuffer = vi.fn(
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
        copyToChannel: vi.fn((src: Float32Array, ch: number) => {
          channelArrays[ch].set(src);
        }),
      };
    }
  );

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
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain,
    createBufferSource,
    createBuffer,
    createdSources,
  };
}
