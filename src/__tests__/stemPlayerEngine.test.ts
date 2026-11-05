import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StemPlayerEngine,
  ClickTrackMixerState,
  CalibratedClickGrid,
  ClickCalibrationRejection,
  StereoPeakLevels,
  synthesizeClickTrackChannel,
  calibrateClickGrid,
  reanchorBeatGridToAnchor,
} from "../lib/stemPlayerEngine";
import { StemName } from "../lib/chunkOverlapAdd";
import { createMockAudioContext } from "./audioContextMockFactory";

// Click Track helpers (ticket 04): onsets and peak amplitude of a synthesized
// click channel, read at the same external seam the user hears.
function clickOnsets(channel: Float32Array, rate: number): number[] {
  const onsets: number[] = [];
  for (let i = 0; i < channel.length; i++) {
    const nz = Math.abs(channel[i]) > 1e-9;
    const prev = i === 0 ? false : Math.abs(channel[i - 1]) > 1e-9;
    if (nz && !prev) {
      const t = i / rate;
      // The sine crosses exact zero inside a burst; one cluster == one click.
      if (onsets.length === 0 || t - onsets[onsets.length - 1] > 0.1) {
        onsets.push(t);
      }
    }
  }
  return onsets;
}

function peakNear(channel: Float32Array, atSec: number, rate: number): number {
  const center = Math.round(atSec * rate);
  const from = Math.max(0, center - 2);
  const to = Math.min(channel.length, center + Math.round(0.06 * rate));
  let peak = 0;
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(channel[i]));
  return peak;
}

describe("StemPlayerEngine", () => {
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
    mockCtx = createMockAudioContext(10.0);
  });

  describe("Audio Graph Construction and Routing", () => {
    it("creates dedicated GainNodes for all 4 Stems connected to Master Gain, the Peak tap, and Destination", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      expect(mockCtx.createGain).toHaveBeenCalledTimes(5); // 4 stems + 1 master

      // 2026-11-05 peak pips: the meter path IS the audible path — splitter
      // → per-channel analysers → destination inputs 0/1 (live Chrome probes:
      // analysers downmix stereo to mono, and Chrome only pulls analysers
      // that feed the destination). Post-fader, so Master Volume moves stay
      // visible on the pips.
      const masterGain = engine.getMasterGainNode();
      const splitter = mockCtx.createdSplitters[0];
      const merger = mockCtx.createdMergers[0];
      expect(splitter).toBeDefined();
      expect(merger).toBeDefined();
      expect(masterGain.connect).toHaveBeenCalledWith(splitter);
      expect(masterGain.connect).not.toHaveBeenCalledWith(mockCtx.destination);
      expect(mockCtx.createdAnalysers).toHaveLength(2);
      expect(splitter.connect).toHaveBeenCalledWith(
        mockCtx.createdAnalysers[0],
        0,
        0
      );
      expect(splitter.connect).toHaveBeenCalledWith(
        mockCtx.createdAnalysers[1],
        1,
        0
      );
      expect(mockCtx.createdAnalysers[0].connect).toHaveBeenCalledWith(
        merger,
        0,
        0
      );
      expect(mockCtx.createdAnalysers[1].connect).toHaveBeenCalledWith(
        merger,
        0,
        1
      );
      expect(merger.connect).toHaveBeenCalledWith(mockCtx.destination);

      const stemNames: StemName[] = ["vocals", "drums", "bass", "other"];
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

  describe("Stereo Peak Meters (2026-11-05 footer channel)", () => {
    const pumpRaf = (ctx: any, frames: number) => {
      for (let i = 0; i < frames; i++) {
        ctx.currentTime += 0.1;
        const cb = (globalThis as any).__rafQueue.shift();
        if (cb) cb();
      }
    };

    const installRafQueue = () => {
      const queue: (() => void)[] = [];
      (globalThis as any).__rafQueue = queue;
      const origRaf = window.requestAnimationFrame;
      const origCancel = window.cancelAnimationFrame;
      window.requestAnimationFrame = ((cb: () => void) => {
        queue.push(cb);
        return queue.length;
      }) as any;
      window.cancelAnimationFrame = (() => {}) as any;
      return () => {
        window.requestAnimationFrame = origRaf;
        window.cancelAnimationFrame = origCancel;
      };
    };

    it("subscribes at zero, lights from post-fader analyser data while playing, and falls dark on pause", async () => {
      const restoreRaf = installRafQueue();
      try {
        const engine = new StemPlayerEngine(dummyStems, {
          audioContext: mockCtx as any,
          sampleRate,
        });

        const emissions: StereoPeakLevels[] = [];
        const unsub = engine.subscribeLevels((l) => emissions.push(l));

        // Idle: the channel reports a flat, honest zero — no frozen bars.
        expect(engine.getLevels()).toEqual({ left: 0, right: 0 });
        expect(emissions).toEqual([{ left: 0, right: 0 }]);

        // Loud-left (0.5) / quieter-right (0.15) master bus: the sidecar
        // analysers stream that constant signal through getFloatTimeDomainData.
        mockCtx.createdAnalysers[0].fillValue = 0.5;
        mockCtx.createdAnalysers[1].fillValue = 0.15;

        await engine.play();
        pumpRaf(mockCtx, 8);

        const lit = engine.getLevels();
        expect(lit.left).toBeGreaterThan(0.7); // -6 dB RMS sits high on the ladder
        expect(lit.right).toBeGreaterThan(0.5);
        expect(lit.left).toBeGreaterThan(lit.right);

        const coalesced = emissions.length;
        expect(coalesced).toBeGreaterThan(1);
        // Throttled: the meters are painted, not sampled per audio frame.
        expect(coalesced).toBeLessThanOrEqual(12);

        engine.pause();
        expect(engine.getLevels()).toEqual({ left: 0, right: 0 });
        const zeroEmission: StereoPeakLevels = { left: 0, right: 0 };
        expect(emissions[emissions.length - 1]).toEqual(zeroEmission);

        unsub();
        engine.dispose();
      } finally {
        restoreRaf();
      }
    });

    it("keeps the exact pre-fix graph and a silent level channel when the context has no AnalyserNode", () => {
      const bareCtx: any = { ...mockCtx };
      delete bareCtx.createAnalyser;

      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: bareCtx,
        sampleRate,
      });

      expect(engine.getAnalyserNode()).toBeNull();
      expect(engine.getMasterGainNode().connect).toHaveBeenCalledWith(
        bareCtx.destination
      );
      expect(engine.getLevels()).toEqual({ left: 0, right: 0 });
      engine.dispose();
    });
  });

  describe("Synchronized Transport Operations", () => {
    it("starts all 4 stems concurrently at exact audioContext.currentTime when play() is called", async () => {
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

    it("resumes suspended AudioContext when play() is triggered", async () => {
      mockCtx.state = "suspended";
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      await engine.play();
      expect(mockCtx.resume).toHaveBeenCalled();
      expect(engine.isPlaying()).toBe(true);
    });

    it("stops all active source nodes and preserves playback position on pause()", async () => {
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

    it("updates position when seek() is called while paused", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.seek(4.5);
      expect(engine.getCurrentTime()).toBe(4.5);
      expect(mockCtx.createBufferSource).not.toHaveBeenCalled();
    });

    it("restarts all 4 stems synchronously at new offset when seek() is called while playing", async () => {
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

  describe("Mixer Gain Matrix: Volume, Mute, and Solo", () => {
    it("adjusts stem volume directly when no stems are soloed or muted", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume("vocals", 0.65);
      expect(engine.getStemGainNode("vocals").gain.value).toBeCloseTo(0.65);

      engine.setStemVolume("bass", 0.4);
      expect(engine.getStemGainNode("bass").gain.value).toBeCloseTo(0.4);
    });

    it("mutes a stem and restores its volume when unmuted", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume("drums", 0.8);
      expect(engine.getStemGainNode("drums").gain.value).toBeCloseTo(0.8);

      engine.toggleStemMute("drums");
      expect(engine.getStemState("drums").muted).toBe(true);
      expect(engine.getStemGainNode("drums").gain.value).toBe(0);

      engine.toggleStemMute("drums");
      expect(engine.getStemState("drums").muted).toBe(false);
      expect(engine.getStemGainNode("drums").gain.value).toBeCloseTo(0.8);
    });

    it("solo logic: soloing one stem attenuates all other stems to 0 gain", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume("vocals", 0.9);
      engine.setStemVolume("drums", 0.8);
      engine.setStemVolume("bass", 0.7);
      engine.setStemVolume("other", 0.6);

      // Solo drums
      engine.setStemSolo("drums", true);

      expect(engine.getStemGainNode("drums").gain.value).toBeCloseTo(0.8);
      expect(engine.getStemGainNode("vocals").gain.value).toBe(0);
      expect(engine.getStemGainNode("bass").gain.value).toBe(0);
      expect(engine.getStemGainNode("other").gain.value).toBe(0);
    });

    it("solo logic: multiple stems can be soloed concurrently", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume("vocals", 0.9);
      engine.setStemVolume("drums", 0.8);
      engine.setStemVolume("bass", 0.7);
      engine.setStemVolume("other", 0.6);

      // Solo drums and bass
      engine.setStemSolo("drums", true);
      engine.setStemSolo("bass", true);

      expect(engine.getStemGainNode("drums").gain.value).toBeCloseTo(0.8);
      expect(engine.getStemGainNode("bass").gain.value).toBeCloseTo(0.7);
      expect(engine.getStemGainNode("vocals").gain.value).toBe(0);
      expect(engine.getStemGainNode("other").gain.value).toBe(0);

      // Unsolo drums -> only bass remains soloed
      engine.setStemSolo("drums", false);
      expect(engine.getStemGainNode("bass").gain.value).toBeCloseTo(0.7);
      expect(engine.getStemGainNode("drums").gain.value).toBe(0);
      expect(engine.getStemGainNode("vocals").gain.value).toBe(0);

      // Unsolo bass -> all stems restore to their volume
      engine.setStemSolo("bass", false);
      expect(engine.getStemGainNode("vocals").gain.value).toBeCloseTo(0.9);
      expect(engine.getStemGainNode("drums").gain.value).toBeCloseTo(0.8);
      expect(engine.getStemGainNode("bass").gain.value).toBeCloseTo(0.7);
      expect(engine.getStemGainNode("other").gain.value).toBeCloseTo(0.6);
    });

    it("solo logic: solo and mute are per-Stem exclusive, the last press wins", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setStemVolume("vocals", 0.9);
      engine.setStemSolo("vocals", true);
      expect(engine.getStemGainNode("vocals").gain.value).toBeCloseTo(0.9);
      // Solo isolates: the others fall to silence.
      expect(engine.getStemGainNode("drums").gain.value).toBe(0);

      engine.setStemMute("vocals", true);
      // Mix Rail Tidy-Up (ticket 04, ADR-0012): pressing M on the soloed Stem
      // drops the solo — the solo+mute pair is unrepresentable, so the matrix
      // has no all-silent state left to fall into and the others restore.
      expect(engine.getStemGainNode("vocals").gain.value).toBe(0);
      expect(engine.getStemGainNode("drums").gain.value).toBeCloseTo(1);

      engine.setStemSolo("vocals", true);
      // Pressing S again re-arms solo and clears the mute: last press wins.
      expect(engine.getStemGainNode("vocals").gain.value).toBeCloseTo(0.9);
      expect(engine.getStemGainNode("drums").gain.value).toBe(0);
    });

    it("updates master volume", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      engine.setMasterVolume(0.42);
      expect(engine.getMasterVolume()).toBeCloseTo(0.42);
      expect(engine.getMasterGainNode().gain.value).toBeCloseTo(0.42);
    });
  });

  describe("Subscriptions and Lifecycle", () => {
    it("notifies state subscribers on mixer changes", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      const stateCallback = vi.fn();
      const unsub = engine.subscribeState(stateCallback);

      // Called immediately on subscription
      expect(stateCallback).toHaveBeenCalledTimes(1);

      engine.setStemVolume("drums", 0.5);
      expect(stateCallback).toHaveBeenCalledTimes(2);
      expect(stateCallback.mock.calls[1][0].drums.volume).toBeCloseTo(0.5);

      unsub();
      engine.setStemVolume("drums", 0.2);
      expect(stateCallback).toHaveBeenCalledTimes(2);
    });

    it("cleans up resources and disconnects nodes on dispose()", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      const masterGain = engine.getMasterGainNode();
      const vocalsGain = engine.getStemGainNode("vocals");

      engine.dispose();

      expect(masterGain.disconnect).toHaveBeenCalled();
      expect(vocalsGain.disconnect).toHaveBeenCalled();
    });
  });

  describe("Time-Stretch & Pitch Controls", () => {
    it("initializes tempo to 1.0 and pitch to 0", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
      });

      expect(engine.getTempo()).toBe(1.0);
      expect(engine.getPitch()).toBe(0);
      expect(engine.getTimeStretch()).toEqual({ tempo: 1.0, pitch: 0 });
    });

    it("clamps tempo to range [0.5, 2.0]", () => {
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

    it("clamps pitch to range [-12, +12]", () => {
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

    it("resets tempo to 1.0 and pitch to 0 via resetTimeStretch()", () => {
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

    it("notifies subscribers via subscribeTimeStretch", () => {
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

    it("accounts for tempo scaling in playback position tracking", async () => {
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

    it("falls back gracefully in mock/headless environment where audioWorklet is not instantiated", () => {
      // In this environment mockCtx has no audioWorklet
      expect(mockCtx).not.toHaveProperty("audioWorklet");

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

  describe("WSOLA AudioWorklet Transport, Live Scrubbing, and Dynamic Pitch/Tempo Sync", () => {
    let mockWorkletCtx: ReturnType<typeof createMockAudioContext> & {
      audioWorklet: { addModule: any };
    };
    let createdWorkletNodes: any[];

    class MockAudioWorkletNode {
      context: any;
      name: string;
      options: any;
      port: {
        postMessage: any;
        onmessage: ((event: any) => void) | null;
      };
      connect = vi.fn();
      disconnect = vi.fn();

      constructor(context: any, name: string, options: any) {
        this.context = context;
        this.name = name;
        this.options = options;
        this.port = {
          postMessage: vi.fn(),
          onmessage: null,
        };
        createdWorkletNodes.push(this);
      }
    }

    beforeEach(() => {
      createdWorkletNodes = [];
      mockWorkletCtx = {
        ...createMockAudioContext(10.0),
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(undefined),
        },
      };
      (globalThis as any).AudioWorkletNode = MockAudioWorkletNode;
      (window as any).AudioWorkletNode = MockAudioWorkletNode;
    });

    it("initializes AudioWorkletNode and connects all 4 Stem outputs", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockWorkletCtx as any,
        sampleRate,
      });

      const isReady = await engine.waitForWorkletReady();
      expect(isReady).toBe(true);
      expect(engine.isUsingWorklet()).toBe(true);
      expect(createdWorkletNodes).toHaveLength(1);

      const workletNode = createdWorkletNodes[0];
      // Connects 4 outputs (vocals, drums, bass, other)
      expect(workletNode.connect).toHaveBeenCalledTimes(4);
      expect(workletNode.port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "loadStems",
          sampleRate,
        })
      );
    });

    it("performs seamless seeking while playing via AudioWorklet without ghost sources", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockWorkletCtx as any,
        sampleRate,
      });

      await engine.waitForWorkletReady();
      mockWorkletCtx.currentTime = 10.0;
      await engine.play();

      const workletNode = createdWorkletNodes[0];
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "play",
      });
      expect(mockWorkletCtx.createdSources).toHaveLength(0); // 0 ghost sources

      // Advance time by 2.0s
      mockWorkletCtx.currentTime = 12.0;
      expect(engine.getCurrentTime()).toBeCloseTo(2.0, 2);

      // Seek to 6.5s during active playback
      engine.seek(6.5);

      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "seek",
        timeSec: 6.5,
      });
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "play",
      });
      expect(engine.getCurrentTime()).toBeCloseTo(6.5, 2);
      expect(mockWorkletCtx.createdSources).toHaveLength(0); // Still 0 ghost sources

      // Advance time by another 1.0s
      mockWorkletCtx.currentTime = 13.0;
      expect(engine.getCurrentTime()).toBeCloseTo(7.5, 2);
    });

    it("supports rapid scrubbing without audio sticking to old positions", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockWorkletCtx as any,
        sampleRate,
      });

      await engine.waitForWorkletReady();
      mockWorkletCtx.currentTime = 10.0;
      await engine.play();

      const workletNode = createdWorkletNodes[0];

      // Simulate rapid scrubbing events (dragging slider)
      engine.seek(1.0);
      engine.seek(2.5);
      engine.seek(4.2);
      engine.seek(7.8);

      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "seek",
        timeSec: 7.8,
      });
      expect(engine.getCurrentTime()).toBeCloseTo(7.8, 2);
      expect(mockWorkletCtx.createdSources).toHaveLength(0);
    });

    it("adjusts tempo dynamically during active playback preserving musical pitch", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockWorkletCtx as any,
        sampleRate,
      });

      await engine.waitForWorkletReady();
      mockWorkletCtx.currentTime = 10.0;
      await engine.play();

      const workletNode = createdWorkletNodes[0];

      // Advance 2s at 1.0x tempo
      mockWorkletCtx.currentTime = 12.0;
      expect(engine.getCurrentTime()).toBeCloseTo(2.0, 2);

      // Change tempo to 1.5x while playing
      engine.setTempo(1.5);
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "setTempo",
        tempo: 1.5,
      });

      // Position should be continuous at 2.0s
      expect(engine.getCurrentTime()).toBeCloseTo(2.0, 2);

      // Advance 2s of context time at 1.5x tempo (+3.0s audio)
      mockWorkletCtx.currentTime = 14.0;
      expect(engine.getCurrentTime()).toBeCloseTo(5.0, 2);

      // Buffer sources were never touched, preventing tape-resampling chipmunk artifacts
      expect(mockWorkletCtx.createdSources).toHaveLength(0);
    });

    it("adjusts pitch dynamically during active playback without dropping Stems", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockWorkletCtx as any,
        sampleRate,
      });

      await engine.waitForWorkletReady();
      mockWorkletCtx.currentTime = 10.0;
      await engine.play();

      const workletNode = createdWorkletNodes[0];

      engine.setPitch(4);
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "setPitch",
        pitch: 4,
      });
      expect(engine.getPitch()).toBe(4);

      engine.setPitch(-5);
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "setPitch",
        pitch: -5,
      });
      expect(engine.getPitch()).toBe(-5);

      // All 4 outputs remain connected
      expect(workletNode.connect).toHaveBeenCalledTimes(4);
    });

    it("handles seamless migration from fallback sources if play() is called before worklet loads", async () => {
      let resolveAddModule: () => void = () => {};
      const delayedModulePromise = new Promise<void>((res) => {
        resolveAddModule = res;
      });

      mockWorkletCtx.audioWorklet.addModule = vi
        .fn()
        .mockReturnValue(delayedModulePromise);

      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockWorkletCtx as any,
        sampleRate,
      });

      // Play before worklet finishes loading
      mockWorkletCtx.currentTime = 10.0;
      await engine.play();

      expect(engine.isPlaying()).toBe(true);
      // Fallback sources were started immediately so playback is never delayed
      expect(mockWorkletCtx.createdSources).toHaveLength(4);
      const fallbackSources = [...mockWorkletCtx.createdSources];

      mockWorkletCtx.currentTime = 12.5; // 2.5s elapsed

      // Now resolve the AudioWorklet loading
      resolveAddModule();
      await engine.waitForWorkletReady();

      expect(engine.isUsingWorklet()).toBe(true);

      // Fallback sources must be stopped and disconnected immediately without ghost audio
      for (const src of fallbackSources) {
        expect(src.stop).toHaveBeenCalled();
        expect(src.disconnect).toHaveBeenCalled();
      }

      // Worklet must have been started at the exact position
      const workletNode = createdWorkletNodes[0];
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "seek",
        timeSec: expect.closeTo(2.5, 1),
      });
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: "play",
      });
    });

    it("handles ended message from AudioWorklet by pausing and resetting position", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockWorkletCtx as any,
        sampleRate,
      });

      await engine.waitForWorkletReady();
      await engine.play();

      expect(engine.isPlaying()).toBe(true);

      const workletNode = createdWorkletNodes[0];
      expect(workletNode.port.onmessage).toBeDefined();

      // Trigger ended event from worklet
      workletNode.port.onmessage({ data: { type: "ended" } });

      expect(engine.isPlaying()).toBe(false);
      expect(engine.getCurrentTime()).toBe(0);
    });

    it("handles rapid scrubbing in fallback mode without leaving ghost sources", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockWorkletCtx as any,
        sampleRate,
        disableWorklet: true, // Force fallback mode
      });

      mockWorkletCtx.currentTime = 10.0;
      await engine.play();

      // 4 sources active initially
      expect(engine.getActiveSources()).toHaveLength(4);

      // Scrub 3 times in rapid succession
      mockWorkletCtx.currentTime = 11.0;
      engine.seek(3.0);
      expect(engine.getActiveSources()).toHaveLength(4);

      mockWorkletCtx.currentTime = 11.5;
      engine.seek(6.0);
      expect(engine.getActiveSources()).toHaveLength(4);

      mockWorkletCtx.currentTime = 12.0;
      engine.seek(8.5);
      expect(engine.getActiveSources()).toHaveLength(4);

      expect(engine.getCurrentTime()).toBe(8.5);

      // Total created sources = 4 initial + 4*3 scrubs = 16 sources
      expect(mockWorkletCtx.createdSources).toHaveLength(16);

      // All 12 prior sources were stopped and disconnected
      const priorSources = mockWorkletCtx.createdSources.slice(0, 12);
      for (const s of priorSources) {
        expect(s.stop).toHaveBeenCalled();
        expect(s.disconnect).toHaveBeenCalled();
      }

      // Only the last 4 sources remain active
      const finalSources = mockWorkletCtx.createdSources.slice(12);
      for (const s of finalSources) {
        expect(s.stop).not.toHaveBeenCalled();
      }
    });
  });

  describe("Click Track Lane: domain-separate synthesized rail", () => {
    // A rubato Beat Grid: intervals fluctuate, exactly as the Tempo Detector
    // reports beat positions where the beats actually fall.
    const beatGridSec = new Float64Array([
      0.5, 1.0572789, 1.6145578, 2.1718367, 2.7291156,
    ]);

    it("defaults the lane off and keeps the audio graph at 4 Stems + master", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: beatGridSec,
      });

      const lane: ClickTrackMixerState = engine.getClickTrackState();
      // Mix Rail Tidy-Up (ticket 03): the lane concept is {enabled, volume};
      // the separate mute flag died end to end.
      const expectedLaneOff: ClickTrackMixerState = {
        enabled: false,
        volume: 1.0,
      };
      expect(lane).toEqual(expectedLaneOff);
      expect(engine.getClickGainNode()).toBeNull();
      // Lane off: no click gain node and no click channel materialized.
      expect(mockCtx.createGain).toHaveBeenCalledTimes(5);
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(4);

      await engine.play();
      expect(mockCtx.createdSources).toHaveLength(4);
      expect(engine.getActiveSources()).toHaveLength(4);
    });

    it("turns the lane on without touching the four Stems' playback", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: beatGridSec,
      });
      engine.setStemVolume("drums", 0.5);

      engine.toggleClickTrack();
      // One gain node added (4 Stems + master + click), one channel synthesized.
      expect(mockCtx.createGain).toHaveBeenCalledTimes(6);
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(5);
      const clickGain = engine.getClickGainNode();
      if (!clickGain) return;
      expect(clickGain.connect).toHaveBeenCalledWith(
        engine.getMasterGainNode()
      );

      await engine.play();
      // 4 Stem sources plus the click lane; the Stems' gain is untouched.
      expect(mockCtx.createdSources).toHaveLength(5);
      expect(engine.getActiveSources()).toHaveLength(5);
      expect(engine.getStemGainNode("drums").gain.value).toBe(0.5);

      engine.toggleClickTrack();
      // Only the click lane source is stopped: the Stems keep playing.
      const clickSource = mockCtx.createdSources[4];
      expect(clickSource.stop).toHaveBeenCalledTimes(1);
      expect(clickSource.disconnect).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 4; i++) {
        expect(mockCtx.createdSources[i].stop).not.toHaveBeenCalled();
      }
      expect(engine.getActiveSources()).toHaveLength(4);
    });

    it("re-enabling the Click Track mid-playback resumes at the live playhead, not at the last play/seek position", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: beatGridSec,
      });
      engine.setClickTrackEnabled(true);
      await engine.play();
      // play() anchors the lane at (10.0, 0): 0s into the song at t=10.
      expect(mockCtx.createdSources).toHaveLength(5);
      expect(mockCtx.createdSources[4].start).toHaveBeenCalledWith(10, 0);

      // Four seconds in, the user flips the rail off and back on.
      mockCtx.currentTime = 14;
      engine.toggleClickTrack();
      mockCtx.currentTime = 16;
      engine.toggleClickTrack();
      // The resumed lane must anchor at the live playhead (6s at t=16),
      // never where play() started, or the clicks shift off the drums.
      const resumed = mockCtx.createdSources[5];
      expect(resumed.start).toHaveBeenCalledWith(16, 6);
      expect(engine.getActiveSources()).toHaveLength(5);
    });

    it("re-locking the Beat Grid mid-playback relays the lane from the live playhead", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: beatGridSec,
      });
      engine.setClickTrackEnabled(true);
      await engine.play();
      expect(mockCtx.createdSources[4].start).toHaveBeenCalledWith(10, 0);

      mockCtx.currentTime = 14;
      // The user picks another BPM candidate: same grid, new relay anchor.
      engine.setBeatGrid(beatGridSec);
      expect(mockCtx.createdSources).toHaveLength(6);
      expect(mockCtx.createdSources[5].start).toHaveBeenCalledWith(14, 4);
    });

    it("volumes the lane exactly like a Stem lane: zero volume is the lane's silence", () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: beatGridSec,
      });
      engine.setClickTrackEnabled(true);
      const clickGain = engine.getClickGainNode();
      if (!clickGain) return;
      expect(clickGain.gain.value).toBe(1.0);

      engine.setClickTrackVolume(0.4);
      expect(clickGain.gain.value).toBeCloseTo(0.4, 6);
      engine.setClickTrackVolume(0);
      expect(clickGain.gain.value).toBe(0);
      engine.setClickTrackVolume(1.5); // clamped like a Stem lane
      expect(clickGain.gain.value).toBe(1.0);
    });

    it("volume and a transport seek never rebuild the click channel", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: beatGridSec,
      });
      engine.setClickTrackEnabled(true);
      await engine.play();
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(5);

      // Volume and a transport seek never rebuild the channel.
      engine.setClickTrackVolume(0.7);
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(5);
    });

    it("follows Time-Stretch: the click shares the Stems' rate, with no rate of its own", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: beatGridSec,
      });
      engine.setClickTrackEnabled(true);
      await engine.play();

      const clickSource = mockCtx.createdSources[4];
      expect(clickSource.playbackRate.value).toBe(1.0);

      engine.setTempo(1.5);
      // Stems and Click Track alike sit at the shared factor: the lane follows
      // Time-Stretch in lockstep, it is not rated on its own.
      for (const source of mockCtx.createdSources) {
        expect(source.playbackRate.value).toBe(1.5);
      }
      expect(clickSource.playbackRate.setValueAtTime).toHaveBeenCalledWith(
        1.5,
        expect.anything()
      );

      // Scrubbing mid-stretch recreates the lane on the same rate.
      engine.seek(2.0);
      expect(mockCtx.createdSources).toHaveLength(10);
      expect(engine.getActiveSources()).toHaveLength(5);
      expect(mockCtx.createdSources[9].playbackRate.value).toBe(1.5);
      for (let i = 0; i < 5; i++) {
        expect(mockCtx.createdSources[i].stop).toHaveBeenCalled();
      }
    });

    it("synthesizes deterministic bursts on the Beat Grid: every click the same uniform tone", () => {
      const channel = synthesizeClickTrackChannel(beatGridSec, sampleRate, 3);
      const again = synthesizeClickTrackChannel(beatGridSec, sampleRate, 3);
      expect(channel.length).toBe(Math.round(3 * sampleRate));
      for (let i = 0; i < channel.length; i++) {
        expect(channel[i]).toBe(again[i]);
      }

      // One click per Beat Grid position, landing on the grid itself (within a
      // sample), not on a flat BPM re-derivation.
      const onsets = clickOnsets(channel, sampleRate);
      expect(onsets).toHaveLength(beatGridSec.length);
      for (let k = 0; k < beatGridSec.length; k++) {
        expect(Math.abs(onsets[k] - beatGridSec[k])).toBeLessThan(
          (2 / sampleRate) * 10
        );
      }

      // No accent axis anymore (ADR-0011 Amendment): every click carries the
      // same loud tap, so the peak at every grid position is the same and
      // clearly louder than the pre-amendment off-accent amp (0.55).
      const peaks = beatGridSec.map((t) => peakNear(channel, t, sampleRate));
      for (let k = 1; k < peaks.length; k++) {
        expect(peaks[k]).toBeCloseTo(peaks[0], 6);
      }
      expect(peaks[0]).toBeGreaterThan(0.9);
    });

    it("swapping the Beat Grid re-synthesizes the lane the moment it arrives: no stale clicks, mixer and playhead untouched", async () => {
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: beatGridSec,
      });
      engine.setClickTrackEnabled(true);
      engine.setClickTrackVolume(0.7);
      await engine.play();
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(5);
      expect(mockCtx.createdSources).toHaveLength(5);

      // The re-locked Beat Grid from the user's candidate pick: the metric
      // doubling, with beats where the tracker reports they fall. 0.7786 s
      // sits mid-interval of the old grid, a stale-grid giveaway.
      const doublingGrid = new Float64Array([
        0.5, 0.7786395, 1.0572789, 1.3359184, 1.6145578, 1.8931973, 2.1718367,
        2.4504762, 2.7291156,
      ]);

      engine.setBeatGrid(doublingGrid);

      // The channel rebuilt in place, and the lane source playing when the
      // grid arrived was retired and replaced: the heard clicks are the
      // new grid's, never the old grid's.
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(6);
      expect(engine.getBeatGrid()).toEqual(doublingGrid);
      expect(mockCtx.createdSources).toHaveLength(6);
      expect(engine.getActiveSources()).toHaveLength(5);
      const oldClickSource = mockCtx.createdSources[4];
      expect(oldClickSource.stop).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 4; i++) {
        expect(mockCtx.createdSources[i].stop).not.toHaveBeenCalled();
      }

      // Clicks follow the re-locked grid exactly: one per grid position,
      // including the mid-interval beat the old channel was silent at.
      const heard = mockCtx.createdSources[5].buffer.getChannelData(0);
      const onsets = clickOnsets(heard, sampleRate);
      expect(onsets).toHaveLength(doublingGrid.length);
      for (let k = 0; k < doublingGrid.length; k++) {
        expect(Math.abs(onsets[k] - doublingGrid[k])).toBeLessThan(
          (2 / sampleRate) * 10
        );
      }
      expect(peakNear(heard, 0.7786395, sampleRate)).toBeGreaterThan(0);

      // The swap is not a lane reset: mixer settings and the playhead stay
      // where they were.
      const expectedLaneAfterSwap: ClickTrackMixerState = {
        enabled: true,
        volume: 0.7,
      };
      expect(engine.getClickTrackState()).toEqual(expectedLaneAfterSwap);
      expect(engine.getCurrentTime()).toBe(0);
    });

    it("derives pulse and anchor from taps honestly: steady taps calibrate, ragged taps refuse with a reason", () => {
      // Three clean pulses (one ragged-but-medianed outlier gap stays honest
      // at the boundary): median of the deltas survives it.
      const outcome = calibrateClickGrid([2.0, 0.5, 0, 1.0]);
      expect(outcome.kind).toBe("calibrated");
      if (outcome.kind === "calibrated") {
        const calibrated: CalibratedClickGrid = outcome;
        expect(calibrated.pulseSec).toBe(0.5);
        expect(calibrated.bpm).toBe(120);
        expect(calibrated.anchorSec).toBe(0);
        expect(calibrated.tapsSec).toEqual([0, 0.5, 1.0, 2.0]);
      }

      // Fewer than three taps is never a half-calibration.
      const tooFew = calibrateClickGrid([0.5, 1.0]);
      expect(tooFew.kind).toBe("rejected");
      if (tooFew.kind === "rejected") {
        const refused: ClickCalibrationRejection = tooFew;
        expect(refused.reason).toBe("too-few-taps");
        expect(refused.detailSec).toBeNull();
      }

      // A 0.125 s gap (480 BPM territory) refuses honestly, naming the gap.
      const tooClose = calibrateClickGrid([0, 0.25, 0.375]);
      expect(tooClose.kind).toBe("rejected");
      if (tooClose.kind === "rejected") {
        const refused: ClickCalibrationRejection = tooClose;
        expect(refused.reason).toBe("taps-too-close");
        expect(refused.detailSec).toBe(0.125);
      }

      // A 2.625 s gap (22.9 BPM territory) refuses honestly too.
      const tooFar = calibrateClickGrid([0, 0.5, 3.125]);
      expect(tooFar.kind).toBe("rejected");
      if (tooFar.kind === "rejected") {
        const refused: ClickCalibrationRejection = tooFar;
        expect(refused.reason).toBe("taps-too-far");
        expect(refused.detailSec).toBe(2.625);
      }
    });

    it("a hand calibration re-anchors the lane: source.start tracers relay the swapped grid at the live playhead and the heard clicks sit on the tap lattice, not the Detector's", async () => {
      // The Detector's grid, locked at the tapped BPM but anchored off the
      // tap lattice by 0.03 s — a stale-anchor giveaway at every beat.
      const detectorGrid = new Float64Array([0.03, 0.53, 1.03, 1.53, 2.03]);
      const engine = new StemPlayerEngine(dummyStems, {
        audioContext: mockCtx as any,
        sampleRate,
        beatGrid: detectorGrid,
      });
      engine.setClickTrackEnabled(true);
      mockCtx.currentTime = 10;
      await engine.play();
      expect(mockCtx.createdSources[4].start).toHaveBeenCalledWith(10, 0);

      // Four taps half a second apart, the first at 0.5 s.
      const calibration = calibrateClickGrid([0.5, 1.0, 1.5, 2.0]);
      if (calibration.kind !== "calibrated") {
        throw new Error("clean taps must calibrate");
      }
      const handGrid = reanchorBeatGridToAnchor(
        engine.getBeatGrid() ?? detectorGrid,
        calibration.pulseSec,
        calibration.anchorSec
      );
      for (let k = 0; k < handGrid.length; k++) {
        expect(handGrid[k]).toBeCloseTo(k * 0.5, 9);
      }

      // Four seconds into playback the confirm lands: the lane relays from
      // the live playhead with the re-anchored grid.
      mockCtx.currentTime = 14;
      engine.setBeatGrid(handGrid);
      expect(mockCtx.createdSources).toHaveLength(6);
      expect(mockCtx.createdSources[5].start).toHaveBeenCalledWith(14, 4);

      // The heard clicks land on the tap lattice (k*0.5 s) — never back on
      // the Detector's 0.03-offset positions.
      const heard = mockCtx.createdSources[5].buffer.getChannelData(0);
      const onsets = clickOnsets(heard, sampleRate);
      expect(onsets).toHaveLength(handGrid.length);
      for (let k = 0; k < handGrid.length; k++) {
        expect(Math.abs(onsets[k] - k * 0.5)).toBeLessThan(
          (2 / sampleRate) * 10
        );
        expect(Math.abs(onsets[k] - (k * 0.5 + 0.03))).toBeGreaterThan(0.01);
      }
    });
  });
});
