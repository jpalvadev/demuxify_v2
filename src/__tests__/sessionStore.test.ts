import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveActiveSession,
  loadActiveSession,
  hasActiveSession,
  clearActiveSession,
  createSessionAutoSaver,
  DemuxifySession,
  StorageQuotaError,
  SessionClickCalibration,
} from "../lib/sessionStore";
import { StemName } from "../lib/chunkOverlapAdd";
import type { ClickTrackMixerState } from "../lib/stemPlayerEngine";

function createMockSession(
  overrides?: Partial<DemuxifySession>
): DemuxifySession {
  const sampleRate = 44100;
  const numSamples = 1000;
  const channels = [
    new Float32Array(numSamples).fill(0.5),
    new Float32Array(numSamples).fill(-0.5),
  ];

  const stems: Record<StemName, Float32Array[]> = {
    vocals: [
      new Float32Array(numSamples).fill(0.1),
      new Float32Array(numSamples).fill(0.15),
    ],
    drums: [
      new Float32Array(numSamples).fill(0.2),
      new Float32Array(numSamples).fill(0.25),
    ],
    bass: [
      new Float32Array(numSamples).fill(0.3),
      new Float32Array(numSamples).fill(0.35),
    ],
    other: [
      new Float32Array(numSamples).fill(0.4),
      new Float32Array(numSamples).fill(0.45),
    ],
  };

  return {
    metadata: {
      id: "session-123",
      createdAt: 1700000000000,
      updatedAt: 1700000010000,
      title: "Audioslave - Stone",
      filename: "audioslave_stone.mp3",
      duration: 1000 / 44100,
      sampleRate,
    },
    sourceMix: {
      channels,
    },
    stems,
    mixer: {
      stems: {
        vocals: { volume: 0.8, muted: false, solo: false },
        drums: { volume: 0.9, muted: true, solo: false },
        bass: { volume: 1.0, muted: false, solo: true },
        other: { volume: 0.7, muted: false, solo: false },
      },
      masterVolume: 0.95,
      currentTime: 12.34,
      pitchSemitones: 2,
      tempoRatio: 1.1,
    },
    ...overrides,
  };
}

describe("sessionStore", () => {
  beforeEach(async () => {
    await clearActiveSession();
  });

  afterEach(async () => {
    await clearActiveSession();
    vi.restoreAllMocks();
  });

  it("reports hasActiveSession() as false when database is empty", async () => {
    const exists = await hasActiveSession();
    expect(exists).toBe(false);
  });

  it("returns null when loadActiveSession() is called with no stored session", async () => {
    const session = await loadActiveSession();
    expect(session).toBeNull();
  });

  it("saves and restores an active session with full metadata, audio buffers, and mixer settings", async () => {
    const beatGrid = new Float64Array([0.557, 1.114, 1.671, 2.228, 2.785]);
    const mockSession = createMockSession({
      tempo: {
        candidates: [
          { bpm: 107.7, confidence: 0.93 },
          { bpm: 215.4, confidence: 0.61 },
        ],
        chosenTempoBpm: 107.7,
        beatGrid,
        analyzedBpm: 107.7,
        duration: 294.1,
      },
    });

    await saveActiveSession(mockSession);

    const exists = await hasActiveSession();
    expect(exists).toBe(true);

    const loaded = await loadActiveSession();
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    // Verify metadata
    expect(loaded.metadata.id).toBe(mockSession.metadata.id);
    expect(loaded.metadata.title).toBe("Audioslave - Stone");
    expect(loaded.metadata.filename).toBe("audioslave_stone.mp3");
    expect(loaded.metadata.sampleRate).toBe(44100);
    expect(loaded.metadata.duration).toBeCloseTo(mockSession.metadata.duration);

    // Verify Source Mix channels
    expect(loaded.sourceMix.channels).toHaveLength(2);
    expect(loaded.sourceMix.channels[0].length).toBe(1000);
    expect(loaded.sourceMix.channels[0][0]).toBeCloseTo(0.5);
    expect(loaded.sourceMix.channels[1][0]).toBeCloseTo(-0.5);

    // Verify Stem buffers
    expect(loaded.stems.vocals).toHaveLength(2);
    expect(loaded.stems.vocals[0][0]).toBeCloseTo(0.1);
    expect(loaded.stems.drums[0][0]).toBeCloseTo(0.2);
    expect(loaded.stems.bass[0][0]).toBeCloseTo(0.3);
    expect(loaded.stems.other[0][0]).toBeCloseTo(0.4);

    // Verify Mixer settings
    expect(loaded.mixer.masterVolume).toBe(0.95);
    expect(loaded.mixer.currentTime).toBe(12.34);
    expect(loaded.mixer.pitchSemitones).toBe(2);
    expect(loaded.mixer.tempoRatio).toBe(1.1);
    expect(loaded.mixer.stems.vocals.volume).toBe(0.8);
    expect(loaded.mixer.stems.drums.muted).toBe(true);
    expect(loaded.mixer.stems.bass.solo).toBe(true);

    // Verify Tempo Detector state (ticket 03): candidates, chosen tempo, and
    // the Beat Grid survive the save → reload round-trip identical.
    expect(loaded.tempo).not.toBeNull();
    if (loaded.tempo) {
      expect(loaded.tempo.candidates).toEqual([
        { bpm: 107.7, confidence: 0.93 },
        { bpm: 215.4, confidence: 0.61 },
      ]);
      expect(loaded.tempo.chosenTempoBpm).toBe(107.7);
      expect(loaded.tempo.analyzedBpm).toBe(107.7);
      expect(loaded.tempo.duration).toBe(294.1);
      expect(loaded.tempo.beatGrid).toHaveLength(beatGrid.length);
      for (let i = 0; i < beatGrid.length; i++) {
        expect(loaded.tempo.beatGrid[i]).toBe(beatGrid[i]);
      }
    }
  });

  it("round-trips a re-locked Session: the feel the Beat Grid is locked to survives even when it is not the engine's top reading", async () => {
    const doublingGrid = new Float64Array([0.279, 0.557, 0.836, 1.115]);
    const mockSession = createMockSession({
      tempo: {
        candidates: [
          { bpm: 107.7, confidence: 0.93 },
          { bpm: 215.4, confidence: 0.61 },
        ],
        // The user picked the metric doubling; the engine still ranks 107.7
        // top, so the ranking and the chosen feel must survive separately.
        chosenTempoBpm: 215.4,
        beatGrid: doublingGrid,
        analyzedBpm: 215.4,
        duration: 294.1,
      },
    });

    await saveActiveSession(mockSession);

    const loaded = await loadActiveSession();
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    expect(loaded.tempo).not.toBeNull();
    if (loaded.tempo) {
      expect(loaded.tempo.candidates).toEqual([
        { bpm: 107.7, confidence: 0.93 },
        { bpm: 215.4, confidence: 0.61 },
      ]);
      expect(loaded.tempo.chosenTempoBpm).toBe(215.4);
      expect(loaded.tempo.analyzedBpm).toBe(215.4);
      expect(loaded.tempo.duration).toBe(294.1);
      expect(loaded.tempo.beatGrid).toHaveLength(doublingGrid.length);
      for (let i = 0; i < doublingGrid.length; i++) {
        expect(loaded.tempo.beatGrid[i]).toBe(doublingGrid[i]);
      }
    }
  });

  it("loads sessions written before the Tempo Detector shipped without tempo state", async () => {
    // Backwards compatibility: the state is optional on read, so a legacy
    // Session simply loads with no tempo field and Session Recovery
    // re-runs the detector instead.
    const legacySession = createMockSession();

    await saveActiveSession(legacySession);

    const loaded = await loadActiveSession();
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    expect(loaded.tempo).toBeUndefined();
  });

  it("round-trips Click Track lane settings and leaves legacy sessions without them", async () => {
    // Ticket 05: Click Track settings persist with the Session, parallel to
    // the Stem mixer contract — the four StemName identities and their mixer
    // settings above are untouched by this field.
    const clickTrack: ClickTrackMixerState = {
      enabled: true,
      volume: 0.6,
    };
    const mockSession = createMockSession({ clickTrack });

    await saveActiveSession(mockSession);

    const loaded = await loadActiveSession();
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    expect(loaded.clickTrack).toEqual(clickTrack);

    // Sessions saved without the lane (never enabled, or pre-lane) load
    // without the field: the rail resumes off by default.
    const legacySession = createMockSession();
    await saveActiveSession(legacySession);
    const legacy = await loadActiveSession();
    expect(legacy).not.toBeNull();
    if (!legacy) return;
    expect(legacy.clickTrack).toBeUndefined();
  });

  it("round-trips a Hand Calibration and leaves sessions that never hand-calibrated without one", async () => {
    // Ticket 08: the taps-to-pulse reading persists with the Session as its
    // own field, sibling to tempo — the ranked candidates above are untouched
    // by it, and a by-hand decision never masquerades as a Detector reading.
    const calibration: SessionClickCalibration = {
      bpm: 120,
      pulseSec: 0.5,
      anchorSec: 90.25,
      tapsSec: [90.25, 90.75, 91.25, 91.75],
    };
    const mockSession = createMockSession({ calibration });

    await saveActiveSession(mockSession);

    const loaded = await loadActiveSession();
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    expect(loaded.calibration).toEqual(calibration);

    // Sessions that never hand-calibrated (or pre-ticket-08) load without the
    // field: nothing half-calibrated is invented on read.
    const neverCalibrated = createMockSession();
    await saveActiveSession(neverCalibrated);
    const never = await loadActiveSession();
    expect(never).not.toBeNull();
    if (!never) return;
    expect(never.calibration).toBeUndefined();
  });

  it("starts fresh for old Sessions that wrote a Downbeat Phase or a Meter", async () => {
    // No backwards compatibility (ADR-0011 Amendment): the Click Track has no
    // Downbeat Phase or Meter field anymore, so nothing reads or re-guesses
    // one — a resumed Session simply gets the lane as it is stored now.
    const resumedClickTrack: ClickTrackMixerState = {
      enabled: true,
      volume: 0.5,
    };
    const mockSession = createMockSession({
      clickTrack: resumedClickTrack,
    });
    await saveActiveSession(mockSession);
    const loaded = await loadActiveSession();
    expect(loaded).not.toBeNull();
    if (loaded) {
      expect(loaded.clickTrack).toEqual(resumedClickTrack);
    }
  });

  it("loads legacy Click Track lane payloads carrying a mute flag as the reduced lane", async () => {
    // Mix Rail Tidy-Up (ticket 03): the mute control died, so old persisted
    // lanes still validate — the extra muted key is simply dropped, the rest
    // round-trips, and an old muted:true payload loads as the lane exactly as
    // it is now (enabled + volume), never as a refusal.
    const legacyStoredLane = {
      enabled: true,
      muted: true,
      volume: 0.5,
    };
    const mockSession = createMockSession({
      clickTrack: legacyStoredLane as unknown as ClickTrackMixerState,
    });
    await saveActiveSession(mockSession);
    const loaded = await loadActiveSession();
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    expect(loaded.clickTrack).toEqual({ enabled: true, volume: 0.5 });
  });

  it("clears active session safely and releases storage", async () => {
    const mockSession = createMockSession();
    await saveActiveSession(mockSession);

    expect(await hasActiveSession()).toBe(true);

    await clearActiveSession();

    expect(await hasActiveSession()).toBe(false);
    expect(await loadActiveSession()).toBeNull();
  });

  it("overwrites previous session when a new session is saved", async () => {
    const session1 = createMockSession({
      metadata: {
        id: "session-1",
        createdAt: 1000,
        updatedAt: 1000,
        title: "Song One",
        filename: "song1.mp3",
        duration: 10,
        sampleRate: 44100,
      },
    });

    const session2 = createMockSession({
      metadata: {
        id: "session-2",
        createdAt: 2000,
        updatedAt: 2000,
        title: "Song Two",
        filename: "song2.mp3",
        duration: 20,
        sampleRate: 48000,
      },
    });

    await saveActiveSession(session1);
    await saveActiveSession(session2);

    const loaded = await loadActiveSession();
    expect(loaded?.metadata.id).toBe("session-2");
    expect(loaded?.metadata.title).toBe("Song Two");
    expect(loaded?.metadata.sampleRate).toBe(48000);
  });

  it("handles OPFS storage when navigator.storage.getDirectory is available", async () => {
    const mockFiles: Record<string, Uint8Array> = {};

    const mockRootHandle = {
      getDirectoryHandle: vi
        .fn()
        .mockImplementation(
          async (dirName: string, _options?: { create?: boolean }) => {
            return {
              getFileHandle: vi
                .fn()
                .mockImplementation(
                  async (
                    fileName: string,
                    _fileOptions?: { create?: boolean }
                  ) => {
                    const key = `${dirName}/${fileName}`;
                    return {
                      createWritable: vi.fn().mockResolvedValue({
                        write: vi
                          .fn()
                          .mockImplementation(async (data: BufferSource) => {
                            const u8 =
                              data instanceof Uint8Array
                                ? data
                                : new Uint8Array(data as ArrayBuffer);
                            mockFiles[key] = u8;
                          }),
                        close: vi.fn().mockResolvedValue(undefined),
                      }),
                      getFile: vi.fn().mockResolvedValue({
                        arrayBuffer: vi.fn().mockImplementation(async () => {
                          const data = mockFiles[key];
                          if (!data) throw new Error("File not found");
                          return data.buffer.slice(
                            data.byteOffset,
                            data.byteOffset + data.byteLength
                          );
                        }),
                      }),
                    };
                  }
                ),
              removeEntry: vi.fn().mockImplementation(async (name: string) => {
                delete mockFiles[`${dirName}/${name}`];
              }),
            };
          }
        ),
      removeEntry: vi.fn().mockImplementation(async (name: string) => {
        for (const k of Object.keys(mockFiles)) {
          if (k.startsWith(`${name}/`)) {
            delete mockFiles[k];
          }
        }
      }),
    };

    const originalStorage = navigator.storage;
    Object.defineProperty(navigator, "storage", {
      value: {
        ...originalStorage,
        getDirectory: vi.fn().mockResolvedValue(mockRootHandle),
      },
      configurable: true,
    });

    const mockSession = createMockSession({
      metadata: {
        id: "opfs-session",
        createdAt: 3000,
        updatedAt: 3000,
        title: "OPFS Song",
        filename: "opfs.mp3",
        duration: 5,
        sampleRate: 44100,
      },
    });

    await saveActiveSession(mockSession);
    expect(await hasActiveSession()).toBe(true);

    const loaded = await loadActiveSession();
    expect(loaded?.metadata.title).toBe("OPFS Song");
    expect(loaded?.sourceMix.channels[0][0]).toBeCloseTo(0.5);
    expect(loaded?.stems.vocals[0][0]).toBeCloseTo(0.1);

    await clearActiveSession();
    expect(await hasActiveSession()).toBe(false);

    Object.defineProperty(navigator, "storage", {
      value: originalStorage,
      configurable: true,
    });
  });

  it("validates corrupted session schema gracefully and returns null", async () => {
    // Manually inject invalid session into indexedDB
    const req = indexedDB.open("demuxify-sessions-db", 1);
    await new Promise<void>((resolve, reject) => {
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("audio_buffers")) {
          db.createObjectStore("audio_buffers");
        }
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction("sessions", "readwrite");
        const store = tx.objectStore("sessions");
        // Malformed record missing metadata and mixer
        store.put({ id: "active_session", corrupt: true });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      req.onerror = () => reject(req.error);
    });

    const loaded = await loadActiveSession();
    expect(loaded).toBeNull();
  });

  it("handles QuotaExceededError and wraps it in StorageQuotaError", async () => {
    const quotaErr = new DOMException("Quota exceeded", "QuotaExceededError");
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(() => {
        throw quotaErr;
      });

    const mockSession = createMockSession();
    await expect(saveActiveSession(mockSession)).rejects.toThrow(
      StorageQuotaError
    );

    spy.mockRestore();
  });

  it("debounces auto-save operations and executes with the latest state", async () => {
    const autoSaver = createSessionAutoSaver(40);

    const sessionA = createMockSession({
      metadata: {
        id: "session-debounce",
        createdAt: 1,
        updatedAt: 1,
        title: "Song Version 1",
        filename: "v1.mp3",
        duration: 10,
        sampleRate: 44100,
      },
    });

    const sessionB = createMockSession({
      metadata: {
        id: "session-debounce",
        createdAt: 1,
        updatedAt: 2,
        title: "Song Version 2",
        filename: "v2.mp3",
        duration: 10,
        sampleRate: 44100,
      },
    });

    autoSaver.debounceSave(sessionA);
    autoSaver.debounceSave(sessionB);

    // Should not have saved immediately
    expect(await hasActiveSession()).toBe(false);

    // Wait past the debounce delay
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(await hasActiveSession()).toBe(true);
    const loaded = await loadActiveSession();
    expect(loaded?.metadata.title).toBe("Song Version 2");
  });

  it("allows canceling scheduled debounced saves", async () => {
    const autoSaver = createSessionAutoSaver(40);
    const session = createMockSession();

    autoSaver.debounceSave(session);
    autoSaver.cancel();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await hasActiveSession()).toBe(false);
  });
});
