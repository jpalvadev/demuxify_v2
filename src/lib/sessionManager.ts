import { StemName, STEM_NAMES } from "./chunkOverlapAdd";
import { ModelId } from "./modelConfig";
import type { ClickTrackMixerState } from "./stemPlayerEngine";
import {
  saveActiveSession,
  loadActiveSession,
  hasActiveSession,
  clearActiveSession,
  DemuxifySession,
  SessionMetadata,
  SessionMixerState,
  StemMixerSettings,
  SessionTempoState,
  SessionClickCalibration,
  StorageQuotaError,
} from "./sessionStore";

export { StorageQuotaError };
export type {
  DemuxifySession,
  SessionMetadata,
  SessionMixerState,
  StemMixerSettings,
  SessionTempoState,
  SessionClickCalibration,
};

export type SessionLifecycleStatus =
  "idle" | "detected" | "resuming" | "active" | "error";

export interface SessionSnapshot {
  status: SessionLifecycleStatus;
  session: DemuxifySession | null;
  detectedMetadata: SessionMetadata | null;
  isSaving: boolean;
  lastSaveError: Error | null;
}

export interface CreateSessionParams {
  metadata?: Partial<SessionMetadata> & {
    title: string;
    filename: string;
    duration: number;
    sampleRate: number;
    size?: number;
    modelProfileId?: ModelId;
  };
  sourceMix: {
    channels: Float32Array[];
  };
  stems: Record<StemName, Float32Array[]>;
  mixer?: Partial<SessionMixerState>;
  tempo?: SessionTempoState;
  clickTrack?: ClickTrackMixerState;
  calibration?: SessionClickCalibration;
}

export interface StorageAdapter {
  saveActiveSession: (session: DemuxifySession) => Promise<void>;
  loadActiveSession: () => Promise<DemuxifySession | null>;
  hasActiveSession: () => Promise<boolean>;
  clearActiveSession: () => Promise<void>;
}

export interface SessionManagerOptions {
  persistence?: "storage" | "memory-only";
  debounceMs?: number;
  onSaveError?: (error: unknown) => void;
  storageAdapter?: StorageAdapter;
}

export interface SessionManager {
  snapshot: () => SessionSnapshot;
  getSnapshot: () => SessionSnapshot;
  subscribe: (listener: (snapshot: SessionSnapshot) => void) => () => void;
  createSession: (params: CreateSessionParams) => Promise<void>;
  updateMixer: (
    mixerUpdate: Partial<SessionMixerState>,
    clickTrack?: ClickTrackMixerState
  ) => void;
  attachTempo: (
    tempo: SessionTempoState,
    calibration?: SessionClickCalibration | null
  ) => void;
  flush: () => Promise<void>;
  dispose: () => void;
  checkPrevious?: () => Promise<SessionMetadata | null>;
  resume?: () => Promise<DemuxifySession>;
  purge?: () => Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 600;

function clamp(val: number, min: number, max: number): number {
  if (isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function createDefaultMixerState(): SessionMixerState {
  return {
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
  };
}

function snapshotEquals(a: SessionSnapshot, b: SessionSnapshot): boolean {
  return (
    a.status === b.status &&
    a.session === b.session &&
    a.detectedMetadata === b.detectedMetadata &&
    a.isSaving === b.isSaving &&
    a.lastSaveError === b.lastSaveError
  );
}

export function createSessionManager(
  options: SessionManagerOptions = {}
): SessionManager {
  const persistence = options.persistence ?? "storage";
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const onSaveError = options.onSaveError;
  const adapter: StorageAdapter = options.storageAdapter ?? {
    saveActiveSession,
    loadActiveSession,
    hasActiveSession,
    clearActiveSession,
  };

  let snapshot: SessionSnapshot = {
    status: "idle",
    session: null,
    detectedMetadata: null,
    isSaving: false,
    lastSaveError: null,
  };

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(snapshot: SessionSnapshot) => void>();

  const publish = (next: SessionSnapshot) => {
    if (snapshotEquals(snapshot, next)) return;
    snapshot = next;
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener safety
      }
    }
  };

  const scheduleDebouncedSave = () => {
    if (persistence === "memory-only") return;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void flush();
    }, debounceMs);
  };

  const flush = async (): Promise<void> => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (persistence === "memory-only" || !snapshot.session) {
      return;
    }

    publish({
      ...snapshot,
      isSaving: true,
    });

    try {
      await adapter.saveActiveSession(snapshot.session);
      publish({
        ...snapshot,
        isSaving: false,
        lastSaveError: null,
      });
    } catch (err) {
      const saveError = err instanceof Error ? err : new Error(String(err));
      publish({
        ...snapshot,
        isSaving: false,
        lastSaveError: saveError,
      });
      onSaveError?.(err);
    }
  };

  const createSession = async (params: CreateSessionParams): Promise<void> => {
    const defaultMixer = createDefaultMixerState();
    const mixerState: SessionMixerState = {
      ...defaultMixer,
      ...params.mixer,
      stems: {
        ...defaultMixer.stems,
        ...(params.mixer?.stems ?? {}),
      },
    };

    const now = Date.now();
    const meta: SessionMetadata = {
      id: params.metadata?.id ?? `session-${now}`,
      createdAt: params.metadata?.createdAt ?? now,
      updatedAt: params.metadata?.updatedAt ?? now,
      title: params.metadata?.title ?? "Untitled Session",
      filename: params.metadata?.filename ?? "untitled.wav",
      duration: params.metadata?.duration ?? 0,
      sampleRate: params.metadata?.sampleRate ?? 44100,
      size: params.metadata?.size,
      modelProfileId: params.metadata?.modelProfileId,
    };

    const session: DemuxifySession = {
      metadata: meta,
      sourceMix: params.sourceMix,
      stems: params.stems,
      mixer: mixerState,
      tempo: params.tempo,
      clickTrack: params.clickTrack,
      calibration: params.calibration,
    };

    publish({
      ...snapshot,
      status: "active",
      session,
      lastSaveError: null,
    });

    scheduleDebouncedSave();
  };

  const updateMixer = (
    mixerUpdate: Partial<SessionMixerState>,
    clickTrack?: ClickTrackMixerState
  ): void => {
    if (!snapshot.session) return;

    const currentMixer = snapshot.session.mixer;
    const nextStems = { ...currentMixer.stems };

    if (mixerUpdate.stems) {
      for (const stem of STEM_NAMES) {
        const update = mixerUpdate.stems[stem];
        if (update) {
          const prev = nextStems[stem] ?? {
            volume: 1.0,
            muted: false,
            solo: false,
          };
          const nextVolume =
            typeof update.volume === "number"
              ? clamp(update.volume, 0, 1)
              : prev.volume;

          let nextSolo =
            typeof update.solo === "boolean" ? update.solo : prev.solo;
          let nextMuted =
            typeof update.muted === "boolean" ? update.muted : prev.muted;

          // ADR-0012: solo and mute mutual exclusivity
          // solo drops mute; mute drops solo.
          if (update.solo === true) {
            nextSolo = true;
            nextMuted = false;
          } else if (update.muted === true) {
            nextMuted = true;
            nextSolo = false;
          }

          nextStems[stem] = {
            volume: nextVolume,
            muted: nextMuted,
            solo: nextSolo,
          };
        }
      }
    }

    const nextMasterVolume =
      typeof mixerUpdate.masterVolume === "number"
        ? clamp(mixerUpdate.masterVolume, 0, 1)
        : currentMixer.masterVolume;

    const nextCurrentTime =
      typeof mixerUpdate.currentTime === "number"
        ? Math.max(0, mixerUpdate.currentTime)
        : currentMixer.currentTime;

    const nextMixer: SessionMixerState = {
      ...currentMixer,
      ...mixerUpdate,
      stems: nextStems,
      masterVolume: nextMasterVolume,
      currentTime: nextCurrentTime,
    };

    const nextSession: DemuxifySession = {
      ...snapshot.session,
      mixer: nextMixer,
      clickTrack: clickTrack ?? snapshot.session.clickTrack,
    };

    publish({
      ...snapshot,
      session: nextSession,
    });

    scheduleDebouncedSave();
  };

  const attachTempo = (
    tempo: SessionTempoState,
    calibration?: SessionClickCalibration | null
  ): void => {
    if (!snapshot.session) return;

    // Honest supersession: calibration is stored beside tempo only if provided;
    // changing candidate/re-locking without calibration supersedes/clears it.
    const nextSession: DemuxifySession = {
      ...snapshot.session,
      tempo,
      calibration: calibration ?? undefined,
    };

    publish({
      ...snapshot,
      session: nextSession,
    });

    scheduleDebouncedSave();
  };

  const dispose = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    listeners.clear();
  };

  const manager: SessionManager = {
    snapshot: () => snapshot,
    getSnapshot: () => snapshot,
    subscribe: (listener: (snap: SessionSnapshot) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    createSession,
    updateMixer,
    attachTempo,
    flush,
    dispose,
  };

  return manager;
}
