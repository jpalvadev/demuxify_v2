import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StemPlayerEngine } from '../lib/stemPlayerEngine';
import { StemName } from '../lib/chunkOverlapAdd';

function createMockAudioContext() {
  let currentTime = 10.0;

  const mockDestination = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

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

  const createdSources: any[] = [];
  const createBufferSource = vi.fn(() => {
    const sourceNode = {
      buffer: null as any,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as any,
    };
    createdSources.push(sourceNode);
    return sourceNode;
  });

  const createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => {
    const channelArrays = Array.from({ length: channels }, () => new Float32Array(length));
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
  });

  return {
    get currentTime() {
      return currentTime;
    },
    set currentTime(t: number) {
      currentTime = t;
    },
    state: 'running' as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    destination: mockDestination,
    createGain,
    createBufferSource,
    createBuffer,
    createdSources,
  };
}

describe('StemPlayerEngine', () => {
  let mockCtx: ReturnType<typeof createMockAudioContext>;
  const sampleRate = 44100;
  const sampleCount = 44100 * 10; // 10 seconds

  const dummyStems: Record<StemName, Float32Array[]> = {
    vocals: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    drums: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    bass: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    other: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
  };

  beforeEach(() => {
    mockCtx = createMockAudioContext();
  });

  describe('Audio Graph Construction and Routing', () => {
    it('creates dedicated GainNodes for all 4 Stems connected to Master Gain and Destination', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      expect(mockCtx.createGain).toHaveBeenCalledTimes(5); // 4 stems + 1 master

      const masterGain = engine.getMasterGainNode();
      expect(masterGain.connect).toHaveBeenCalledWith(mockCtx.destination);

      const stemNames: StemName[] = ['vocals', 'drums', 'bass', 'other'];
      for (const stem of stemNames) {
        const stemGain = engine.getStemGainNode(stem);
        expect(stemGain).toBeDefined();
        expect(stemGain.connect).toHaveBeenCalledWith(masterGain);
      }

      expect(engine.getDuration()).toBe(10);
      expect(engine.getCurrentTime()).toBe(0);
      expect(engine.isPlaying()).toBe(false);
    });
  });

  describe('Synchronized Transport Operations', () => {
    it('starts all 4 stems concurrently at exact audioContext.currentTime when play() is called', async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      mockCtx.currentTime = 15.5;
      await engine.play();

      expect(engine.isPlaying()).toBe(true);
      expect(mockCtx.createdSources).toHaveLength(4);

      for (const src of mockCtx.createdSources) {
        expect(src.start).toHaveBeenCalledTimes(1);
        expect(src.start).toHaveBeenCalledWith(15.5, 0);
      }
    });

    it('resumes suspended AudioContext when play() is triggered', async () => {
      mockCtx.state = 'suspended';
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      await engine.play();
      expect(mockCtx.resume).toHaveBeenCalled();
      expect(engine.isPlaying()).toBe(true);
    });

    it('stops all active source nodes and preserves playback position on pause()', async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      mockCtx.currentTime = 20.0;
      await engine.play();

      // Advance time by 3.2 seconds
      mockCtx.currentTime = 23.2;

      engine.pause();

      expect(engine.isPlaying()).toBe(false);
      expect(engine.getCurrentTime()).toBeCloseTo(3.2, 2);

      for (const src of mockCtx.createdSources) {
        expect(src.stop).toHaveBeenCalledTimes(1);
        expect(src.disconnect).toHaveBeenCalledTimes(1);
      }
    });

    it('updates position when seek() is called while paused', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.seek(4.5);
      expect(engine.getCurrentTime()).toBe(4.5);
      expect(mockCtx.createBufferSource).not.toHaveBeenCalled();
    });

    it('restarts all 4 stems synchronously at new offset when seek() is called while playing', async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      mockCtx.currentTime = 5.0;
      await engine.play();

      const initialSources = [...mockCtx.createdSources];
      expect(initialSources).toHaveLength(4);

      // Seek to 7.0 seconds at time 8.0
      mockCtx.currentTime = 8.0;
      engine.seek(7.0);

      // Initial sources stopped
      for (const src of initialSources) {
        expect(src.stop).toHaveBeenCalledTimes(1);
      }

      // 4 new sources created and started at offset 7.0 at current time 8.0
      expect(mockCtx.createdSources).toHaveLength(8);
      const newSources = mockCtx.createdSources.slice(4);
      for (const src of newSources) {
        expect(src.start).toHaveBeenCalledWith(8.0, 7.0);
      }

      expect(engine.getCurrentTime()).toBe(7.0);
    });
  });

  describe('Mixer Gain Matrix: Volume, Mute, and Solo', () => {
    it('adjusts stem volume directly when no stems are soloed or muted', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume('vocals', 0.65);
      expect(engine.getStemGainNode('vocals').gain.value).toBeCloseTo(0.65);

      engine.setStemVolume('bass', 0.4);
      expect(engine.getStemGainNode('bass').gain.value).toBeCloseTo(0.4);
    });

    it('mutes a stem and restores its volume when unmuted', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume('drums', 0.8);
      expect(engine.getStemGainNode('drums').gain.value).toBeCloseTo(0.8);

      engine.toggleStemMute('drums');
      expect(engine.getStemState('drums').muted).toBe(true);
      expect(engine.getStemGainNode('drums').gain.value).toBe(0);

      engine.toggleStemMute('drums');
      expect(engine.getStemState('drums').muted).toBe(false);
      expect(engine.getStemGainNode('drums').gain.value).toBeCloseTo(0.8);
    });

    it('solo logic: soloing one stem attenuates all other stems to 0 gain', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume('vocals', 0.9);
      engine.setStemVolume('drums', 0.8);
      engine.setStemVolume('bass', 0.7);
      engine.setStemVolume('other', 0.6);

      // Solo drums
      engine.setStemSolo('drums', true);

      expect(engine.getStemGainNode('drums').gain.value).toBeCloseTo(0.8);
      expect(engine.getStemGainNode('vocals').gain.value).toBe(0);
      expect(engine.getStemGainNode('bass').gain.value).toBe(0);
      expect(engine.getStemGainNode('other').gain.value).toBe(0);
    });

    it('solo logic: multiple stems can be soloed concurrently', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume('vocals', 0.9);
      engine.setStemVolume('drums', 0.8);
      engine.setStemVolume('bass', 0.7);
      engine.setStemVolume('other', 0.6);

      // Solo drums and bass
      engine.setStemSolo('drums', true);
      engine.setStemSolo('bass', true);

      expect(engine.getStemGainNode('drums').gain.value).toBeCloseTo(0.8);
      expect(engine.getStemGainNode('bass').gain.value).toBeCloseTo(0.7);
      expect(engine.getStemGainNode('vocals').gain.value).toBe(0);
      expect(engine.getStemGainNode('other').gain.value).toBe(0);

      // Unsolo drums -> only bass remains soloed
      engine.setStemSolo('drums', false);
      expect(engine.getStemGainNode('bass').gain.value).toBeCloseTo(0.7);
      expect(engine.getStemGainNode('drums').gain.value).toBe(0);
      expect(engine.getStemGainNode('vocals').gain.value).toBe(0);

      // Unsolo bass -> all stems restore to their volume
      engine.setStemSolo('bass', false);
      expect(engine.getStemGainNode('vocals').gain.value).toBeCloseTo(0.9);
      expect(engine.getStemGainNode('drums').gain.value).toBeCloseTo(0.8);
      expect(engine.getStemGainNode('bass').gain.value).toBeCloseTo(0.7);
      expect(engine.getStemGainNode('other').gain.value).toBeCloseTo(0.6);
    });

    it('solo logic: a soloed stem that is also muted has 0 gain', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume('vocals', 0.9);
      engine.setStemSolo('vocals', true);
      expect(engine.getStemGainNode('vocals').gain.value).toBeCloseTo(0.9);

      engine.setStemMute('vocals', true);
      expect(engine.getStemGainNode('vocals').gain.value).toBe(0);

      engine.setStemMute('vocals', false);
      expect(engine.getStemGainNode('vocals').gain.value).toBeCloseTo(0.9);
    });

    it('updates master volume', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setMasterVolume(0.42);
      expect(engine.getMasterVolume()).toBeCloseTo(0.42);
      expect(engine.getMasterGainNode().gain.value).toBeCloseTo(0.42);
    });
  });

  describe('Subscriptions and Lifecycle', () => {
    it('notifies state subscribers on mixer changes', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      const stateCallback = vi.fn();
      const unsub = engine.subscribeState(stateCallback);

      // Called immediately on subscription
      expect(stateCallback).toHaveBeenCalledTimes(1);

      engine.setStemVolume('drums', 0.5);
      expect(stateCallback).toHaveBeenCalledTimes(2);
      expect(stateCallback.mock.calls[1][0].drums.volume).toBeCloseTo(0.5);

      unsub();
      engine.setStemVolume('drums', 0.2);
      expect(stateCallback).toHaveBeenCalledTimes(2);
    });

    it('cleans up resources and disconnects nodes on dispose()', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      const masterGain = engine.getMasterGainNode();
      const vocalsGain = engine.getStemGainNode('vocals');

      engine.dispose();

      expect(masterGain.disconnect).toHaveBeenCalled();
      expect(vocalsGain.disconnect).toHaveBeenCalled();
    });
  });

  describe('Time-Stretch & Pitch Controls', () => {
    it('initializes tempo to 1.0 and pitch to 0', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      expect(engine.getTempo()).toBe(1.0);
      expect(engine.getPitch()).toBe(0);
      expect(engine.getTimeStretch()).toEqual({ tempo: 1.0, pitch: 0 });
    });

    it('clamps tempo to range [0.5, 2.0]', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setTempo(1.5);
      expect(engine.getTempo()).toBe(1.5);

      engine.setTempo(0.2);
      expect(engine.getTempo()).toBe(0.5);

      engine.setTempo(3.0);
      expect(engine.getTempo()).toBe(2.0);
    });

    it('clamps pitch to range [-12, +12]', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setPitch(3);
      expect(engine.getPitch()).toBe(3);

      engine.setPitch(-15);
      expect(engine.getPitch()).toBe(-12);

      engine.setPitch(14);
      expect(engine.getPitch()).toBe(12);
    });

    it('resets tempo to 1.0 and pitch to 0 via resetTimeStretch()', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setTempo(1.75);
      engine.setPitch(-4);
      expect(engine.getTimeStretch()).toEqual({ tempo: 1.75, pitch: -4 });

      engine.resetTimeStretch();
      expect(engine.getTempo()).toBe(1.0);
      expect(engine.getPitch()).toBe(0);
      expect(engine.getTimeStretch()).toEqual({ tempo: 1.0, pitch: 0 });
    });

    it('notifies subscribers via subscribeTimeStretch', () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      const listener = vi.fn();
      const unsub = engine.subscribeTimeStretch(listener);

      expect(listener).toHaveBeenCalledWith({ tempo: 1.0, pitch: 0 });

      engine.setTempo(1.25);
      expect(listener).toHaveBeenCalledWith({ tempo: 1.25, pitch: 0 });

      engine.setPitch(2);
      expect(listener).toHaveBeenCalledWith({ tempo: 1.25, pitch: 2 });

      unsub();
      engine.setTempo(1.5);
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('accounts for tempo scaling in playback position tracking', async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setTempo(2.0);
      await engine.play();

      // In 1 second of audioContext time at 2.0x tempo, 2.0 seconds of audio elapsed
      mockCtx.currentTime = 11.0; // +1.0 sec
      expect(engine.getCurrentTime()).toBeCloseTo(2.0, 2);

      // Now set tempo to 0.5x while playing
      engine.setTempo(0.5);
      // Offset should be locked at 2.0, and 1 more second of real time adds 0.5s of audio
      mockCtx.currentTime = 12.0; // +1.0 sec further
      expect(engine.getCurrentTime()).toBeCloseTo(2.5, 2);
    });

    it('falls back gracefully in mock/headless environment where audioWorklet is not instantiated', () => {
      // In this environment mockCtx has no audioWorklet
      expect(mockCtx).not.toHaveProperty('audioWorklet');

      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      // Should not throw and methods work seamlessly
      expect(() => {
        engine.setTempo(1.2);
        engine.setPitch(-2);
        engine.resetTimeStretch();
      }).not.toThrow();
    });
  });
});
