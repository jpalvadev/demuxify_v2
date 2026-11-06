import { StemName, STEM_NAMES } from "./chunkOverlapAdd";
import { ModelId } from "./modelConfig";
import type { TempoCandidate } from "../workers/beatDetection.worker";
import type { ClickTrackMixerState } from "./stemPlayerEngine";

export class StorageQuotaError extends Error {
  constructor(
    message: string = "Browser storage quota exceeded while saving audio session."
  ) {
    super(message);
    this.name = "StorageQuotaError";
  }
}

export interface SessionMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  filename: string;
  duration: number;
  sampleRate: number;
  size?: number;
  modelProfileId?: ModelId;
}

export interface StemMixerSettings {
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface SessionMixerState {
  stems: Record<StemName, StemMixerSettings>;
  masterVolume: number;
  currentTime: number;
  pitchSemitones?: number;
  tempoRatio?: number;
}

export interface DemuxifySession {
  metadata: SessionMetadata;
  sourceMix: {
    channels: Float32Array[];
  };
  stems: Record<StemName, Float32Array[]>;
  mixer: SessionMixerState;
  // Tempo Detector state (ADR-0010): optional, domain-separate from the
  // four StemName identities and the mixer settings. Sessions written
  // before the Tempo Detector shipped simply omit it.
  tempo?: SessionTempoState;
  // Click Track lane settings (ADR-0010, ticket 05): parallel to the Stem
  // mixer contract, never part of it. Optional: sessions saved before the
  // lane shipped (or with the lane never enabled) simply omit it and resume
  // with the rail off by default.
  clickTrack?: ClickTrackMixerState;
  // Hand Calibration (ticket 08): the taps-to-pulse reading the user anchored
  // the Beat Grid to, kept when automatic detection missed. Optional like the
  // other tempo-domain fields: sessions that never hand-calibrated omit it.
  calibration?: SessionClickCalibration;
}

// Tempo Detector state persisted with a Session (ADR-0010): ranked BPM
// candidates + the user-chosen tempo (re-lock) + the Beat Grid of beat
// positions in seconds. Kept out of SessionMixerState on purpose: the Click
// Track is domain-separate and never one of the four StemName identities.
export interface SessionTempoState {
  candidates: TempoCandidate[];
  chosenTempoBpm?: number;
  beatGrid: Float64Array;
  analyzedBpm: number;
  duration: number;
}

// Hand Calibration persisted with a Session (ticket 08): the pulse/BPM derived
// from the user's taps plus the anchor tap the Beat Grid was slid to. Kept as
// its own field, sibling to tempo: it records a by-hand decision, which is
// never folded into the Detector's ranked candidates.
export interface SessionClickCalibration {
  bpm: number;
  pulseSec: number;
  anchorSec: number;
  tapsSec: number[];
}

interface StoredSessionRecord {
  id: "active_session";
  sessionId: string;
  storageType: "indexeddb" | "opfs";
  metadata: SessionMetadata;
  mixer: SessionMixerState;
  tempo?: SessionTempoState;
  clickTrack?: ClickTrackMixerState;
  calibration?: SessionClickCalibration;
  sourceMixChannelCount: number;
  sourceMixLength: number;
  stemsLengths: Record<StemName, { channelCount: number; length: number }>;
}

const DB_NAME = "demuxify-sessions-db";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const AUDIO_BUFFERS_STORE = "audio_buffers";
const ACTIVE_SESSION_KEY = "active_session";
const OPFS_DIR_NAME = "demuxify_sessions";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(
        new Error("IndexedDB is not supported in this environment.")
      );
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(AUDIO_BUFFERS_STORE)) {
        db.createObjectStore(AUDIO_BUFFERS_STORE);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function isOpfsAvailable(): Promise<boolean> {
  try {
    return Boolean(
      typeof navigator !== "undefined" &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === "function"
    );
  } catch {
    return false;
  }
}

async function getOpfsSessionDirectory(
  sessionId: string
): Promise<FileSystemDirectoryHandle | null> {
  if (!(await isOpfsAvailable())) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(`${OPFS_DIR_NAME}_${sessionId}`, {
      create: true,
    });
  } catch {
    return null;
  }
}

async function removeOpfsSessionDirectory(sessionId: string): Promise<void> {
  if (!(await isOpfsAvailable())) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(`${OPFS_DIR_NAME}_${sessionId}`, {
      recursive: true,
    });
  } catch {
    // Ignore error if directory doesn't exist
  }
}

async function writeOpfsBuffer(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  buffer: Float32Array
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  const byteView = new Uint8Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength
  );
  await writable.write(byteView as unknown as BufferSource);
  await writable.close();
}

async function readOpfsBuffer(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<Float32Array> {
  const fileHandle = await dirHandle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const ab = await file.arrayBuffer();
  return new Float32Array(ab);
}

function isQuotaError(err: unknown): boolean {
  if (err instanceof StorageQuotaError) return true;
  if (err && typeof err === "object") {
    const e = err as { name?: string; message?: string; code?: number };
    return (
      e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      (typeof e.message === "string" && /quota/i.test(e.message))
    );
  }
  return false;
}

export async function hasActiveSession(): Promise<boolean> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(SESSIONS_STORE, "readonly");
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.get(ACTIVE_SESSION_KEY);
        req.onsuccess = () => {
          db.close();
          resolve(Boolean(req.result));
        };
        req.onerror = () => {
          db.close();
          resolve(false);
        };
      } catch {
        db.close();
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

function toFloat32Array(val: unknown): Float32Array {
  if (val instanceof Float32Array) {
    return val;
  }
  if (ArrayBuffer.isView(val)) {
    return new Float32Array(val.buffer, val.byteOffset, val.byteLength / 4);
  }
  if (
    val instanceof ArrayBuffer ||
    (val && typeof (val as any).byteLength === "number")
  ) {
    return new Float32Array(val as ArrayBuffer);
  }
  return new Float32Array(val as any);
}

function isValidMetadata(meta: any): meta is SessionMetadata {
  return (
    meta &&
    typeof meta.id === "string" &&
    typeof meta.title === "string" &&
    typeof meta.filename === "string" &&
    typeof meta.duration === "number" &&
    typeof meta.sampleRate === "number" &&
    !isNaN(meta.duration) &&
    !isNaN(meta.sampleRate)
  );
}

export async function loadActiveSessionMetadata(): Promise<SessionMetadata | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(SESSIONS_STORE, "readonly");
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.get(ACTIVE_SESSION_KEY);
        req.onsuccess = () => {
          db.close();
          const record = req.result as StoredSessionRecord | undefined;
          if (record && isValidMetadata(record.metadata)) {
            resolve(record.metadata);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

function isValidMixer(mixer: any): mixer is SessionMixerState {
  if (
    !mixer ||
    typeof mixer !== "object" ||
    typeof mixer.masterVolume !== "number"
  ) {
    return false;
  }
  if (!mixer.stems || typeof mixer.stems !== "object") return false;
  for (const stem of STEM_NAMES) {
    const s = mixer.stems[stem];
    if (
      !s ||
      typeof s.volume !== "number" ||
      typeof s.muted !== "boolean" ||
      typeof s.solo !== "boolean"
    ) {
      return false;
    }
  }
  return true;
}

// ADR-0012 (Mix Rail Tidy-Up, ticket 04): solo and mute are per-Stem exclusive.
// The write side needs no rule — the engine cannot produce the pair — but a
// legacy Session may still carry it. The load sanitizer resolves solo-wins:
// a restored Session has no press order to replay, and solo is the
// intent-revealing state, so the mute flag drops silently.
function sanitizeMixer(mixer: SessionMixerState): SessionMixerState {
  const stems = { ...mixer.stems };
  for (const stem of STEM_NAMES) {
    if (stems[stem].solo) stems[stem] = { ...stems[stem], muted: false };
  }
  return { ...mixer, stems };
}

function isValidClickTrack(val: any): val is ClickTrackMixerState {
  if (!val || typeof val !== "object") return false;
  return (
    typeof val.enabled === "boolean" &&
    // Mix Rail Tidy-Up (ticket 03): a legacy payload may still carry a
    // muted key — it is not required here and load drops it (below).
    typeof val.volume === "number" &&
    !isNaN(val.volume)
  );
}

// Same honest gate as the Click Track settings (ticket 08): a malformed or
// half-written calibration loads as absent, never as a half-calibration.
function isValidCalibration(val: any): val is SessionClickCalibration {
  if (!val || typeof val !== "object") return false;
  if (
    typeof val.bpm !== "number" ||
    !isFinite(val.bpm) ||
    val.bpm <= 0 ||
    typeof val.pulseSec !== "number" ||
    !isFinite(val.pulseSec) ||
    val.pulseSec <= 0 ||
    typeof val.anchorSec !== "number" ||
    !isFinite(val.anchorSec) ||
    !Array.isArray(val.tapsSec) ||
    val.tapsSec.length === 0
  ) {
    return false;
  }
  return val.tapsSec.every(
    (t: unknown) => typeof t === "number" && isFinite(t)
  );
}

export async function saveActiveSession(
  session: DemuxifySession
): Promise<void> {
  try {
    const db = await openDatabase();
    let useOpfs = false;
    let opfsDir: FileSystemDirectoryHandle | null = null;

    try {
      opfsDir = await getOpfsSessionDirectory(session.metadata.id);
      if (opfsDir) {
        useOpfs = true;
      }
    } catch {
      useOpfs = false;
    }

    // Save audio buffers to OPFS or IndexedDB
    if (useOpfs && opfsDir) {
      try {
        // Save Source Mix channels
        for (let c = 0; c < session.sourceMix.channels.length; c++) {
          await writeOpfsBuffer(
            opfsDir,
            `source_mix_${c}.bin`,
            session.sourceMix.channels[c]
          );
        }
        // Save Stem channels
        for (const stem of STEM_NAMES) {
          const stemChs = session.stems[stem] || [];
          for (let c = 0; c < stemChs.length; c++) {
            await writeOpfsBuffer(opfsDir, `stem_${stem}_${c}.bin`, stemChs[c]);
          }
        }
      } catch (err) {
        if (isQuotaError(err)) {
          db.close();
          throw new StorageQuotaError();
        }
        // Fallback to IndexedDB if OPFS write fails
        useOpfs = false;
      }
    }

    const stemsLengths: Record<
      StemName,
      { channelCount: number; length: number }
    > = {} as any;
    for (const stem of STEM_NAMES) {
      const chs = session.stems[stem] || [];
      stemsLengths[stem] = {
        channelCount: chs.length,
        length: chs[0]?.length ?? 0,
      };
    }

    const sessionRecord: StoredSessionRecord = {
      id: ACTIVE_SESSION_KEY,
      sessionId: session.metadata.id,
      storageType: useOpfs ? "opfs" : "indexeddb",
      metadata: { ...session.metadata, updatedAt: Date.now() },
      mixer: {
        stems: { ...session.mixer.stems },
        masterVolume: session.mixer.masterVolume,
        currentTime: session.mixer.currentTime,
        pitchSemitones: session.mixer.pitchSemitones ?? 0,
        tempoRatio: session.mixer.tempoRatio ?? 1.0,
      },
      tempo: session.tempo
        ? {
            candidates: session.tempo.candidates.map((c) => ({ ...c })),
            chosenTempoBpm: session.tempo.chosenTempoBpm,
            beatGrid: session.tempo.beatGrid,
            analyzedBpm: session.tempo.analyzedBpm,
            duration: session.tempo.duration,
          }
        : undefined,
      clickTrack: session.clickTrack
        ? {
            enabled: session.clickTrack.enabled,
            volume: session.clickTrack.volume,
          }
        : undefined,
      calibration: session.calibration
        ? {
            bpm: session.calibration.bpm,
            pulseSec: session.calibration.pulseSec,
            anchorSec: session.calibration.anchorSec,
            tapsSec: [...session.calibration.tapsSec],
          }
        : undefined,
      sourceMixChannelCount: session.sourceMix.channels.length,
      sourceMixLength: session.sourceMix.channels[0]?.length ?? 0,
      stemsLengths,
    };

    await new Promise<void>((resolve, reject) => {
      try {
        const storeNames = useOpfs
          ? [SESSIONS_STORE]
          : [SESSIONS_STORE, AUDIO_BUFFERS_STORE];
        const tx = db.transaction(storeNames, "readwrite");

        tx.oncomplete = () => {
          db.close();
          resolve();
        };

        tx.onerror = () => {
          const err = tx.error;
          db.close();
          if (isQuotaError(err)) {
            reject(new StorageQuotaError());
          } else {
            reject(err);
          }
        };

        tx.onabort = () => {
          const err = tx.error;
          db.close();
          if (isQuotaError(err)) {
            reject(new StorageQuotaError());
          } else {
            reject(err || new Error("Transaction aborted"));
          }
        };

        const sessionStore = tx.objectStore(SESSIONS_STORE);
        sessionStore.put(sessionRecord);

        if (!useOpfs) {
          const bufferStore = tx.objectStore(AUDIO_BUFFERS_STORE);
          // Store source mix channels
          for (let c = 0; c < session.sourceMix.channels.length; c++) {
            bufferStore.put(session.sourceMix.channels[c], `source_mix_${c}`);
          }
          // Store stem channels
          for (const stem of STEM_NAMES) {
            const chs = session.stems[stem] || [];
            for (let c = 0; c < chs.length; c++) {
              bufferStore.put(chs[c], `stem_${stem}_${c}`);
            }
          }
        }
      } catch (err) {
        db.close();
        if (isQuotaError(err)) {
          reject(new StorageQuotaError());
        } else {
          reject(err);
        }
      }
    });
  } catch (err) {
    if (isQuotaError(err)) {
      throw new StorageQuotaError();
    }
    throw err;
  }
}

export async function loadActiveSession(): Promise<DemuxifySession | null> {
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    return null;
  }

  const record: StoredSessionRecord | null = await new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSIONS_STORE, "readonly");
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.get(ACTIVE_SESSION_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  if (
    !record ||
    !isValidMetadata(record.metadata) ||
    !isValidMixer(record.mixer)
  ) {
    db.close();
    return null;
  }

  try {
    const sourceChannels: Float32Array[] = [];
    const stems: Record<StemName, Float32Array[]> = {
      vocals: [],
      drums: [],
      bass: [],
      other: [],
    };

    if (record.storageType === "opfs") {
      const opfsDir = await getOpfsSessionDirectory(record.sessionId);
      if (!opfsDir) {
        db.close();
        return null;
      }

      for (let c = 0; c < record.sourceMixChannelCount; c++) {
        const buf = await readOpfsBuffer(opfsDir, `source_mix_${c}.bin`);
        sourceChannels.push(buf);
      }

      for (const stem of STEM_NAMES) {
        const count = record.stemsLengths[stem]?.channelCount ?? 0;
        for (let c = 0; c < count; c++) {
          const buf = await readOpfsBuffer(opfsDir, `stem_${stem}_${c}.bin`);
          stems[stem].push(buf);
        }
      }
    } else {
      // Load from IndexedDB audio_buffers
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(AUDIO_BUFFERS_STORE, "readonly");
          const bufferStore = tx.objectStore(AUDIO_BUFFERS_STORE);

          let pending = 0;
          let failed = false;

          const checkDone = () => {
            if (pending === 0 && !failed) {
              resolve();
            }
          };

          for (let c = 0; c < record.sourceMixChannelCount; c++) {
            pending++;
            const req = bufferStore.get(`source_mix_${c}`);
            req.onsuccess = () => {
              if (req.result) {
                sourceChannels[c] = toFloat32Array(req.result);
              }
              pending--;
              checkDone();
            };
            req.onerror = () => {
              failed = true;
              reject(req.error);
            };
          }

          for (const stem of STEM_NAMES) {
            const count = record.stemsLengths[stem]?.channelCount ?? 0;
            stems[stem] = [];
            for (let c = 0; c < count; c++) {
              pending++;
              const req = bufferStore.get(`stem_${stem}_${c}`);
              req.onsuccess = () => {
                if (req.result) {
                  stems[stem][c] = toFloat32Array(req.result);
                }
                pending--;
                checkDone();
              };
              req.onerror = () => {
                failed = true;
                reject(req.error);
              };
            }
          }

          if (pending === 0) {
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      });
    }

    db.close();

    // Verify all channels were loaded
    if (sourceChannels.length !== record.sourceMixChannelCount) {
      return null;
    }
    for (const stem of STEM_NAMES) {
      const expected = record.stemsLengths[stem]?.channelCount ?? 0;
      if (stems[stem].length !== expected) {
        return null;
      }
    }

    return {
      metadata: record.metadata,
      sourceMix: {
        channels: sourceChannels,
      },
      stems,
      // ADR-0012: legacy payloads with solo and muted together load solo-wins.
      mixer: sanitizeMixer(record.mixer),
      // Optional on read: sessions written before the Tempo Detector shipped
      // simply load without it (ticket 03 backwards-compat box).
      tempo: record.tempo ?? undefined,
      // Same on the Click Track lane settings (ticket 05): absent, legacy, or
      // malformed records load without it, and the rail resumes off by
      // default.
      // Mix Rail Tidy-Up (ticket 03): the lane is reconstituted reduced, so
      // a legacy record still carrying a mute flag loads without it and an
      // old muted:true never resurfaces as behavior (ADR-0010 Amendment).
      clickTrack: isValidClickTrack(record.clickTrack)
        ? {
            enabled: record.clickTrack.enabled,
            volume: record.clickTrack.volume,
          }
        : undefined,
      // Hand Calibration (ticket 08): absent, legacy, or malformed records
      // load without it, exactly like the other tempo-domain fields.
      calibration: isValidCalibration(record.calibration)
        ? record.calibration
        : undefined,
    };
  } catch {
    db.close();
    return null;
  }
}

export async function clearActiveSession(): Promise<void> {
  try {
    const db = await openDatabase();
    // Retrieve record to find session id for OPFS cleanup
    const record: StoredSessionRecord | null = await new Promise((resolve) => {
      try {
        const tx = db.transaction(SESSIONS_STORE, "readonly");
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.get(ACTIVE_SESSION_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    if (record?.sessionId) {
      await removeOpfsSessionDirectory(record.sessionId);
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(
          [SESSIONS_STORE, AUDIO_BUFFERS_STORE],
          "readwrite"
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.objectStore(SESSIONS_STORE).clear();
        tx.objectStore(AUDIO_BUFFERS_STORE).clear();
      } catch (err) {
        db.close();
        reject(err);
      }
    });
  } catch {
    // Ignore cleanup error if db does not exist
  }
}

/**
 * @deprecated Retired in ADR-0018 in favor of headless SessionManager.
 * Creates an auto-saver debouncer that invokes saveActiveSession
 * after a specified delay when mixer settings change.
 */
export function createSessionAutoSaver(debounceMs: number = 800) {
  let timer: any = null;

  return {
    saveImmediately: async (session: DemuxifySession) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return await saveActiveSession(session);
    },
    debounceSave: (
      session: DemuxifySession,
      onError?: (err: unknown) => void
    ) => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(async () => {
        timer = null;
        try {
          await saveActiveSession(session);
        } catch (err) {
          onError?.(err);
        }
      }, debounceMs);
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
