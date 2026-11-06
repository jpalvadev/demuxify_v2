import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSessionManager,
  SessionManager,
  StorageQuotaError,
} from "../lib/sessionManager";
import { StemName } from "../lib/chunkOverlapAdd";
import type {
  SessionTempoState,
  SessionClickCalibration,
} from "../lib/sessionStore";
import type { ClickTrackMixerState } from "../lib/stemPlayerEngine";

function createMockSessionParams() {
  const sampleRate = 44100;
  const numSamples = 1000;
  return {
    metadata: {
      id: "session-test-1",
      title: "Audioslave - Stone",
      filename: "stone.mp3",
      duration: numSamples / sampleRate,
      sampleRate,
    },
    sourceMix: {
      channels: [
        new Float32Array(numSamples).fill(0.1),
        new Float32Array(numSamples).fill(-0.1),
      ],
    },
    stems: {
      vocals: [new Float32Array(numSamples).fill(0.2)],
      drums: [new Float32Array(numSamples).fill(0.3)],
      bass: [new Float32Array(numSamples).fill(0.4)],
      other: [new Float32Array(numSamples).fill(0.5)],
    } as Record<StemName, Float32Array[]>,
  };
}

describe("SessionManager - Core & Reactive Seam (Ticket 01)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("initializes with idle status and reference-stable initial snapshot", () => {
    const manager: SessionManager = createSessionManager({
      persistence: "memory-only",
    });

    const s1 = manager.snapshot();
    const s2 = manager.snapshot();

    expect(s1).toBe(s2);
    expect(s1.status).toBe("idle");
    expect(s1.session).toBeNull();
    expect(s1.detectedMetadata).toBeNull();
    expect(s1.isSaving).toBe(false);
    expect(s1.lastSaveError).toBeNull();
  });

  it("notifies subscriber when createSession is called and updates status to active", async () => {
    const manager = createSessionManager({ persistence: "memory-only" });
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);

    const params = createMockSessionParams();
    await manager.createSession(params);

    expect(listener).toHaveBeenCalled();
    const snap = manager.snapshot();
    expect(snap.status).toBe("active");
    expect(snap.session).not.toBeNull();
    expect(snap.session?.metadata.title).toBe("Audioslave - Stone");
    expect(snap.session?.mixer.masterVolume).toBe(1.0);
    expect(snap.session?.mixer.stems.vocals.volume).toBe(1.0);

    unsubscribe();
    manager.updateMixer({ masterVolume: 0.8 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("enforces ADR-0012 solo/mute mutual exclusivity and volume clamping on updateMixer", async () => {
    const manager = createSessionManager({ persistence: "memory-only" });
    await manager.createSession(createMockSessionParams());

    // 1. Muting vocals
    manager.updateMixer({
      stems: {
        vocals: { volume: 0.8, muted: true, solo: false },
        drums: { volume: 1.0, muted: false, solo: false },
        bass: { volume: 1.0, muted: false, solo: false },
        other: { volume: 1.0, muted: false, solo: false },
      },
    });

    let stems = manager.snapshot().session?.mixer.stems;
    expect(stems?.vocals.muted).toBe(true);
    expect(stems?.vocals.solo).toBe(false);

    // 2. Soloing vocals drops mute
    manager.updateMixer({
      stems: {
        vocals: { volume: 0.8, muted: false, solo: true },
        drums: { volume: 1.0, muted: false, solo: false },
        bass: { volume: 1.0, muted: false, solo: false },
        other: { volume: 1.0, muted: false, solo: false },
      },
    });

    stems = manager.snapshot().session?.mixer.stems;
    expect(stems?.vocals.solo).toBe(true);
    expect(stems?.vocals.muted).toBe(false);

    // 3. Muting vocals drops solo even if caller passes both solo: true and muted: true
    manager.updateMixer({
      stems: {
        vocals: { volume: 1.5, muted: true, solo: false }, // also tests volume clamp
        drums: { volume: -0.2, muted: false, solo: false }, // also tests volume clamp
        bass: { volume: 1.0, muted: false, solo: false },
        other: { volume: 1.0, muted: false, solo: false },
      },
      masterVolume: 2.0,
    });

    stems = manager.snapshot().session?.mixer.stems;
    expect(stems?.vocals.muted).toBe(true);
    expect(stems?.vocals.solo).toBe(false);
    expect(stems?.vocals.volume).toBe(1.0); // clamped to 1.0
    expect(stems?.drums.volume).toBe(0.0); // clamped to 0.0
    expect(manager.snapshot().session?.mixer.masterVolume).toBe(1.0); // clamped to 1.0
  });

  it("updates Click Track settings beside stems in updateMixer", async () => {
    const manager = createSessionManager({ persistence: "memory-only" });
    await manager.createSession(createMockSessionParams());

    const clickTrack: ClickTrackMixerState = {
      enabled: true,
      volume: 0.75,
    };

    manager.updateMixer({}, clickTrack);

    const expectedClickTrack: ClickTrackMixerState = {
      enabled: true,
      volume: 0.75,
    };
    expect(manager.snapshot().session?.clickTrack).toEqual(expectedClickTrack);
  });

  it("attaches tempo and calibration with honest supersession on attachTempo", async () => {
    const manager = createSessionManager({ persistence: "memory-only" });
    await manager.createSession(createMockSessionParams());

    const tempo1: SessionTempoState = {
      candidates: [{ bpm: 120, confidence: 0.9 }],
      chosenTempoBpm: 120,
      beatGrid: new Float64Array([0.0, 0.5, 1.0]),
      analyzedBpm: 120,
      duration: 10,
    };

    const calibration: SessionClickCalibration = {
      bpm: 120.5,
      pulseSec: 0.498,
      anchorSec: 0.05,
      tapsSec: [0.05, 0.55, 1.05],
    };

    manager.attachTempo(tempo1, calibration);
    expect(manager.snapshot().session?.tempo).toEqual(tempo1);
    expect(manager.snapshot().session?.calibration).toEqual(calibration);

    // Re-locking tempo without calibration honestly supersedes and clears calibration
    const tempo2: SessionTempoState = {
      ...tempo1,
      chosenTempoBpm: 60,
    };
    manager.attachTempo(tempo2, null);
    expect(manager.snapshot().session?.tempo?.chosenTempoBpm).toBe(60);
    expect(manager.snapshot().session?.calibration).toBeUndefined();
  });

  it("debounces storage persistence at 600 ms and flush forces immediate persistence", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const storageAdapter = {
      saveActiveSession: mockSave,
      loadActiveSession: vi.fn().mockResolvedValue(null),
      hasActiveSession: vi.fn().mockResolvedValue(false),
      clearActiveSession: vi.fn().mockResolvedValue(undefined),
    };

    const manager = createSessionManager({
      persistence: "storage",
      debounceMs: 600,
      storageAdapter,
    });

    await manager.createSession(createMockSessionParams());
    expect(mockSave).not.toHaveBeenCalled();

    // Advance 300 ms -> should not have saved yet
    vi.advanceTimersByTime(300);
    expect(mockSave).not.toHaveBeenCalled();

    // Trigger another update at 300 ms -> resets debounce timer
    manager.updateMixer({ masterVolume: 0.5 });
    vi.advanceTimersByTime(300);
    expect(mockSave).not.toHaveBeenCalled();

    // Advance remaining 300 ms (total 600 ms from last update) -> saves
    await vi.advanceTimersByTimeAsync(300);
    expect(mockSave).toHaveBeenCalledTimes(1);

    // Call flush() immediately forces save
    manager.updateMixer({ masterVolume: 0.3 });
    await manager.flush();
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it("cancels pending debounced save when dispose() is called", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const storageAdapter = {
      saveActiveSession: mockSave,
      loadActiveSession: vi.fn().mockResolvedValue(null),
      hasActiveSession: vi.fn().mockResolvedValue(false),
      clearActiveSession: vi.fn().mockResolvedValue(undefined),
    };

    const manager = createSessionManager({
      persistence: "storage",
      debounceMs: 600,
      storageAdapter,
    });

    await manager.createSession(createMockSessionParams());
    manager.dispose();

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("captures StorageQuotaError on snapshot.lastSaveError without crashing the active in-memory session", async () => {
    const quotaErr = new StorageQuotaError("Quota exceeded test");
    const mockSave = vi.fn().mockRejectedValue(quotaErr);
    const onSaveError = vi.fn();

    const storageAdapter = {
      saveActiveSession: mockSave,
      loadActiveSession: vi.fn().mockResolvedValue(null),
      hasActiveSession: vi.fn().mockResolvedValue(false),
      clearActiveSession: vi.fn().mockResolvedValue(undefined),
    };

    const manager = createSessionManager({
      persistence: "storage",
      storageAdapter,
      onSaveError,
    });

    await manager.createSession(createMockSessionParams());
    await manager.flush();

    expect(onSaveError).toHaveBeenCalledWith(quotaErr);
    const snap = manager.snapshot();
    expect(snap.status).toBe("active");
    expect(snap.isSaving).toBe(false);
    expect(snap.lastSaveError).toBe(quotaErr);
    // In-memory session is fully intact
    expect(snap.session).not.toBeNull();
    expect(snap.session?.metadata.title).toBe("Audioslave - Stone");
  });
});
