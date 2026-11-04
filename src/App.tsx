import React, { useEffect, useState, useRef, ChangeEvent } from "react";
import { AlertCircle, Loader2, CheckCircle2, Music } from "lucide-react";
import { BrandUnit } from "./components/BrandUnit";
import { SourceMixDropzone } from "./components/SourceMixDropzone";
import { FallbackAdvisory } from "./components/FallbackAdvisory";
import { SourceMixCard } from "./components/SourceMixCard";
import { MasterWaveform } from "./components/MasterWaveform";
import { BeatGridTapCalibration } from "./components/BeatGridTapCalibration";
import {
  StemPlayer,
  ExportDialogState,
  TransportControls,
} from "./components/StemPlayer";
import { ExportDialog } from "./components/ExportDialog";
import { SessionRecovery } from "./components/SessionRecovery";
import { WebGPUStatusBadge } from "./components/WebGPUStatusBadge";
import {
  SeparationProgress,
  SeparationPhase,
} from "./components/SeparationProgress";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { ModelCacheStatus } from "./components/ModelCacheStatus";
import { ModelSelector } from "./components/ModelSelector";
import {
  isMobileDevice,
  getDefaultModelProfile,
  getModelProfile,
  DEFAULT_MOBILE_MODEL_ID,
  ModelId,
} from "./lib/modelConfig";
import { diagnostics } from "./lib/diagnostics";
import { detectWebGPUCapability, WebGPUCapability } from "./lib/webgpu";
import { decodeAudio, DecodedSourceMix } from "./lib/audioDecoder";
import { computeWaveformPeaks, WaveformPeaks } from "./lib/waveformPeaks";
import {
  InferenceClient,
  ChunkProgress,
  ChunkStartEvent,
} from "./lib/inferenceClient";
import { BeatClient, TempoAnalysisResult } from "./lib/beatClient";
import { DownloadProgress } from "./lib/modelCache";
import { StemName, STEM_NAMES } from "./lib/chunkOverlapAdd";
import {
  loadActiveSession,
  hasActiveSession,
  clearActiveSession,
  createSessionAutoSaver,
  DemuxifySession,
  SessionMixerState,
  SessionClickCalibration,
} from "./lib/sessionStore";
import {
  StemMixerStates,
  ClickTrackMixerState,
  CalibratedClickGrid,
  calibrateClickGrid,
  reanchorBeatGridToAnchor,
} from "./lib/stemPlayerEngine";
import {
  createDebugSessionFixture,
  isDebugModeRequested,
} from "./lib/debugSession";
import { DISPLAY_FONT_STACK, MONO_FONT_STACK } from "./lib/typography";

// Bold pairing (ticket 10): the bundled display face paints the focal Tab banners and
// branding; the bundled mono face is painted inline by the Transport readouts inside the
// Stem Player. These focal nodes carry the stack inline (in addition to the `font-display`
// utilities elsewhere) so the css-asserted app-shell seam can read the applied face
// through getComputedStyle.
const BANNER_FONT = { fontFamily: DISPLAY_FONT_STACK };

const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a"];
const SUPPORTED_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
  "audio/*",
];

interface TabEntry {
  id: string;
  title: string;
  gatedUntilStems: boolean;
}

// Tab Shell registry (ADR-0008): one registry drives the desktop left rail,
// the mobile top strip, and the four pinned Tab panels.
const TAB_REGISTRY: TabEntry[] = [
  { id: "separate", title: "Separate", gatedUntilStems: false },
  { id: "mix", title: "Mix", gatedUntilStems: true },
  { id: "export", title: "Export", gatedUntilStems: true },
  { id: "system", title: "System", gatedUntilStems: false },
];

// Tab Band chip metrics, recorded in docs/adr/0014-coral-on-black-stitch-skin-
// and-the-tab-band.md (anchor discipline: every ADR number is a named const).
// The compact chip: JetBrains-Mono at 11px on a 44px touch target.
const TAB_CHIP_TYPE_PX = 11;
const TAB_CHIP_MIN_TARGET_PX = 44;

const TAB_GATING_REASON = "no Stems yet";

const tabPanelClass = (gated: boolean, active: boolean) =>
  // Tab Shell stage invariant (artifact `.panel` + `.panel.act`): every Tab panel
  // stays in the DOM, but only the ACTIVE Tab's panel paints — the rest are
  // display-hidden inside the stage.
  gated || !active
    ? "hidden"
    : "absolute inset-0 overflow-y-auto overflow-x-hidden rounded border border-muted-foreground/60 bg-card/80 p-4 sm:px-6 sm:py-6 transition-colors";

export const App: React.FC = () => {
  // Dark-only contract (ticket 09): no theme state — html keeps `dark` forever
  // and there is no light-token override block to switch into.

  // Debug mode (ticket 08, user 2026-11-04): `#debug` in the URL boots a
  // synthetic session so every Tab — Mix, Export — renders its full
  // composition without waiting for an upload + WebGPU separation pass.
  // The fixture is synthetic media only (lib/debugSession.ts): real UI code
  // paths paint it, and the auto-saver is disarmed while the flag is on, so
  // debug can never poison the IndexedDB slot a later boot resumes from.
  const debugSession = isDebugModeRequested()
    ? createDebugSessionFixture()
    : null;

  const [capability, setCapability] = useState<WebGPUCapability | null>(null);
  const [isDetectingWebGPU, setIsDetectingWebGPU] = useState(true);

  // Tab Shell (ADR-0007): the rail is interactive — clicking a Tab button moves
  // the stage's active Tab. Gated Tabs stay locked (with the reason line) until
  // Stems exist, so they can never become the active Tab.
  const [selectedTab, setSelectedTab] = useState("separate");

  // Model Profile State
  const [isMobile] = useState(() => isMobileDevice());
  const [selectedModelId, setSelectedModelId] = useState<ModelId>(
    () => getDefaultModelProfile().id
  );

  // Source Mix State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [decodedSourceMix, setDecodedSourceMix] =
    useState<DecodedSourceMix | null>(debugSession?.decodedSourceMix ?? null);
  const [waveformPeaks, setWaveformPeaks] = useState<WaveformPeaks | null>(
    debugSession?.waveformPeaks ?? null
  );
  const [currentTime, setCurrentTime] = useState(
    debugSession?.currentTime ?? 0
  );
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Inference Separation State
  const [separationPhase, setSeparationPhase] = useState<SeparationPhase>(
    debugSession ? "completed" : "idle"
  );
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(
    null
  );
  const [chunkStart, setChunkStart] = useState<ChunkStartEvent | null>(null);
  const [separationError, setSeparationError] = useState<string | null>(null);
  const [separatedStems, setSeparatedStems] = useState<Record<
    StemName,
    Float32Array[]
  > | null>(debugSession?.separatedStems ?? null);

  // Tempo Detector (ADR-0010): ranked BPM candidates + Beat Grid for the
  // Click Track. Domain-separate from the four StemName identities and never
  // a Stem of its own.
  const [tempoAnalysis, setTempoAnalysis] =
    useState<TempoAnalysisResult | null>(debugSession?.tempoAnalysis ?? null);

  // Calibrate the Click (ticket 08): the by-hand reading the rail reports —
  // domain-separate from tempoAnalysis, a hand decision is never dressed
  // up as a Detector reading. Set only when a tap-confirm's grid arrives.
  const [clickCalibration, setClickCalibration] =
    useState<CalibratedClickGrid | null>(null);
  // The tap-confirm keeps its derived pulse until the re-lock pass delivers
  // its Beat Grid; only then is the re-anchor applied, so the Mix Tab stays
  // honest on the old grid while the pass is in flight.
  const pendingCalibrationRef = useRef<CalibratedClickGrid | null>(null);

  // Session Recovery & Persistence State
  const [detectedSession, setDetectedSession] = useState<{
    title: string;
    duration: number;
  } | null>(null);
  const [isResumingSession, setIsResumingSession] = useState(false);
  const [restoredMixerState, setRestoredMixerState] =
    useState<SessionMixerState | null>(null);

  // Export Tab panel state (Tab Shell): fed live from the Stem Player bridge.
  // Ticket 03: the panel is inline, so there is no open/closed state anymore.
  const [exportDialogState, setExportDialogState] =
    useState<ExportDialogState | null>(null);

  // Transport bridge: the Mix Tab's spine scrubbing drives the Stem Player
  // engine (registered by StemPlayer on init, ADR-0008 Tab Shell bridge).
  const transportActionsRef = useRef<TransportControls>({
    play: () => {},
    pause: () => {},
    seekToStart: () => {},
    seek: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inferenceClientRef = useRef<InferenceClient | null>(null);
  // Tempo Detector client ref (ADR-0010): cancelled and nulled when the
  // Source Mix is cleared, like the Inference Engine client.
  const beatClientRef = useRef<BeatClient | null>(null);
  // Last completed Tempo Detector result: attached to the Session snapshot
  // when it saves (ticket 03) and restored on Session Recovery.
  const tempoResultRef = useRef<TempoAnalysisResult | null>(null);
  // Live Click Track rail state (ADR-0010): fed out of the Stem Player so the
  // Session snapshot can persist it (ticket 05). Never part of the Stem mixer.
  const clickTrackStateRef = useRef<ClickTrackMixerState | null>(null);
  const cachedSessionRef = useRef<DemuxifySession | null>(null);
  // Debug mode never writes the Session slot: the flag is a preview of the
  // composition, so the auto-saver is swapped for a silent stand-in while it
  // is on — a debug pass cannot poison what Session Recovery resumes from.
  const autoSaverRef = useRef(
    debugSession
      ? {
          cancel: () => {},
          debounceSave: (_: DemuxifySession, __?: (err: unknown) => void) => {},
          saveImmediately: async (_: DemuxifySession) => {},
        }
      : createSessionAutoSaver(600)
  );

  useEffect(() => {
    const uninstallInterceptors = diagnostics.installGlobalInterceptors();
    diagnostics.info("system", "Demuxify application initialized");
    let isMounted = true;

    async function probeCapability() {
      try {
        const result = await detectWebGPUCapability();
        if (isMounted) {
          setCapability(result);
          diagnostics.info(
            "system",
            `WebGPU capability probed: supported=${result.supported}, isFallback=${result.isFallback}`,
            result.adapterInfo
          );
        }
      } catch (err) {
        if (isMounted) {
          const msg = `WebGPU detection failed: ${err instanceof Error ? err.message : String(err)}`;
          diagnostics.error("system", msg, err);
          setCapability({
            supported: false,
            isFallback: true,
            errorReason: msg,
          });
        }
      } finally {
        if (isMounted) {
          setIsDetectingWebGPU(false);
        }
      }
    }

    probeCapability();

    async function checkPreviousSession() {
      try {
        const hasSession = await hasActiveSession();
        if (hasSession && isMounted) {
          const session = await loadActiveSession();
          if (session && isMounted) {
            cachedSessionRef.current = session;
            setDetectedSession({
              title: session.metadata.title,
              duration: session.metadata.duration,
            });
          }
        }
      } catch {
        // Silently ignore session check error
      }
    }

    checkPreviousSession();

    return () => {
      isMounted = false;
      uninstallInterceptors();
      inferenceClientRef.current?.terminate();
      autoSaverRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    // Dark-only skin: `html.dark` stays permanently so the shadcn dark token
    // set is what every surface paints; no light override block exists.
    document.documentElement.classList.add("dark");
  }, []);

  // Tempo Detector (ADR-0010): fire-and-forget heavy BPM pass over the decoded
  // Source Mix off the main thread. It never gates separation or playback; the
  // ranked candidates land on the Separate tab status line when they arrive.
  // The guard discards stale results if the Source Mix was cleared meanwhile.
  // Ticket 06: the same routine re-runs the pass with a user-selected candidate
  // as the re-lock hint, so the Beat Grid swaps to the chosen feel.
  // Ticket 07 (ADR-0010 Amendment): once the Drums Stem exists, the pass reads
  // that isolated groove channel instead — measured Source Mix slips are
  // detection-quality defects on the fed channel (ADR-0011), and the worker
  // already consumes any Float32Array channel (the re-lock hint reused it).
  // No usable Drums samples keeps the Source Mix channel: fallback, not gap.
  const channelForTempoAnalysis = (
    buffer: AudioBuffer,
    stems: Record<StemName, Float32Array[]> | null
  ): Float32Array => {
    const drumChannels = stems ? stems.drums : null;
    const usable = (drumChannels ?? []).filter((channel) => channel.length > 0);
    if (usable.length > 0) {
      const length = usable.reduce(
        (max, channel) => Math.max(max, channel.length),
        0
      );
      const merged = new Float32Array(length);
      for (const channel of usable) {
        for (let i = 0; i < channel.length; i++) {
          merged[i] += channel[i];
        }
      }
      if (usable.length > 1) {
        for (let i = 0; i < length; i++) {
          merged[i] /= usable.length;
        }
      }
      return merged;
    }
    return buffer.getChannelData(0);
  };

  const startTempoAnalysis = (
    buffer: AudioBuffer,
    hintBpm?: number,
    // Explicit at call sites that just set the stems state in the same tick —
    // the closure's state binding there is still stale; re-lock reads it live.
    stems?: Record<StemName, Float32Array[]> | null
  ) => {
    const samples = channelForTempoAnalysis(
      buffer,
      stems === undefined ? separatedStems : stems
    );
    try {
      const client = new BeatClient();
      beatClientRef.current = client;
      client
        .analyze(samples, buffer.sampleRate, hintBpm)
        .then((rawResult) => {
          if (beatClientRef.current === client) {
            // Calibrate the Click (ticket 08): when this pass came from a
            // tap-confirm, the new Beat Grid slides as one rigid body to the
            // tap lattice at the engine seam — the Detector's beat positions
            // stay (they follow the drums), only the anchor moves.
            const pending = pendingCalibrationRef.current;
            const result = pending
              ? {
                  ...rawResult,
                  beatGrid: reanchorBeatGridToAnchor(
                    rawResult.beatGrid,
                    pending.pulseSec,
                    pending.anchorSec
                  ),
                }
              : rawResult;
            pendingCalibrationRef.current = null;
            setTempoAnalysis(result);
            tempoResultRef.current = result;
            // Honest supersession: any later automatic pass clears the by-
            // hand claim; only a tap-confirm's pass carries one forward.
            // Order matters: the new Beat Grid lands before the claim, so no
            // render ever shows "calibrated by hand" over the old grid.
            setClickCalibration(pending);
            attachTempoResultToSession(
              result,
              pending
                ? {
                    bpm: pending.bpm,
                    pulseSec: pending.pulseSec,
                    anchorSec: pending.anchorSec,
                    tapsSec: pending.tapsSec,
                  }
                : undefined
            );
          }
        })
        .catch(() => {
          // Non-fatal: a failed or cancelled Tempo Detector pass must not
          // surface anywhere else on the page.
        });
    } catch {
      // Worker construction can fail in headless environments; the Tempo
      // Detector is an optional enhancement, never a blocker.
    }
  };

  // A re-locked Beat Grid replaces the one the Session carries, so the auto-
  // saver keeps writing the chosen tempo and its grid (ticket 03 persistence
  // keeps working after every candidate switch). Hand Calibration (ticket 08)
  // rides along: only a tap-confirm pass supplies one, every other pass
  // clears the Session's by-hand reading — honest supersession.
  const attachTempoResultToSession = (
    result: TempoAnalysisResult,
    calibration?: SessionClickCalibration | null
  ) => {
    const session = cachedSessionRef.current;
    if (!session) return;
    const updatedSession: DemuxifySession = {
      ...session,
      tempo: result,
      calibration: calibration ?? undefined,
    };
    cachedSessionRef.current = updatedSession;
    autoSaverRef.current.debounceSave(updatedSession);
  };

  const processAudioFile = async (file: File) => {
    setSelectedFile(file);
    setIsDecoding(true);
    setDecodeError(null);
    setCurrentTime(0);
    setSeparationPhase("idle");
    setSeparatedStems(null);
    setTempoAnalysis(null);
    tempoResultRef.current = null;
    // Calibrate the Click (ticket 08): a fresh track has no by-hand reading.
    setClickCalibration(null);
    pendingCalibrationRef.current = null;

    try {
      const decoded = await decodeAudio(file);
      const peaks = computeWaveformPeaks(decoded.buffer);
      setDecodedSourceMix(decoded);
      setWaveformPeaks(peaks);
      // Explicit null: at decode there is no Drums Stem for THIS file yet —
      // a previous track's stems binding in the closure must not leak in.
      startTempoAnalysis(decoded.buffer, undefined, null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to decode audio file "${file.name}". Please ensure it is a valid, uncorrupted audio file.`;
      setDecodeError(message);
      setDecodedSourceMix(null);
      setWaveformPeaks(null);
    } finally {
      setIsDecoding(false);
    }
  };

  const handleSourceMixSelected = (file: File) => {
    setDetectedSession(null);
    processAudioFile(file);
  };

  const handleClearSourceMix = () => {
    if (inferenceClientRef.current) {
      inferenceClientRef.current.cancel();
    }
    if (beatClientRef.current) {
      beatClientRef.current.cancel();
      beatClientRef.current = null;
    }
    tempoResultRef.current = null;
    autoSaverRef.current.cancel();
    cachedSessionRef.current = null;
    clearActiveSession().catch(() => {});
    setSelectedFile(null);
    setDecodedSourceMix(null);
    setWaveformPeaks(null);
    setCurrentTime(0);
    setDecodeError(null);
    setSeparationPhase("idle");
    setSeparatedStems(null);
    setTempoAnalysis(null);
    tempoResultRef.current = null;
    setClickCalibration(null);
    pendingCalibrationRef.current = null;
    setDownloadProgress(null);
    setChunkProgress(null);
    setChunkStart(null);
    setSeparationError(null);
    setRestoredMixerState(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResumeSession = async () => {
    setIsResumingSession(true);
    try {
      let session = cachedSessionRef.current;
      if (!session) {
        session = await loadActiveSession();
      }
      if (!session) {
        setDetectedSession(null);
        return;
      }

      cachedSessionRef.current = session;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      const numChannels = session.sourceMix.channels.length;
      const length = session.sourceMix.channels[0]?.length ?? 0;
      const buffer = audioCtx.createBuffer(
        numChannels,
        length,
        session.metadata.sampleRate
      );
      for (let c = 0; c < numChannels; c++) {
        buffer.getChannelData(c).set(session.sourceMix.channels[c]);
      }

      const peaks = computeWaveformPeaks(buffer);

      setDecodedSourceMix({
        buffer,
        metadata: {
          fileName: session.metadata.filename,
          fileSize: session.metadata.size ?? 0,
          duration: session.metadata.duration,
          sampleRate: session.metadata.sampleRate,
          numberOfChannels: numChannels,
        },
      });
      setWaveformPeaks(peaks);
      setSeparatedStems(session.stems);
      setRestoredMixerState(session.mixer);
      // Session Recovery (ticket 03): the recovered Session carries its
      // Tempo Detector result, so the Separate-tab readout resumes
      // identical. Sessions without one re-run the detector on the
      // restored Source Mix instead.
      const resumedTempo: TempoAnalysisResult | null = session.tempo
        ? { ...session.tempo }
        : null;
      setTempoAnalysis(resumedTempo);
      tempoResultRef.current = resumedTempo;
      if (!session.tempo) {
        // Same-tick state read would be stale, so the Session's stems are
        // handed over explicitly: the re-detection reads the Drums channel.
        startTempoAnalysis(buffer, undefined, session.stems);
      }
      // Calibrate the Click (ticket 08): a Session that was anchored by hand
      // resumes with that reading, so the rail keeps saying "calibrated by
      // hand"; Sessions without one resume honest about the Detector alone.
      setClickCalibration(
        session.calibration
          ? { ...session.calibration, kind: "calibrated" }
          : null
      );
      // Ticket 05: the recovered Session also carries its Click Track lane
      // settings, so the Mix Tab's rail resumes exactly where it was left
      // (off by default for Sessions that never enabled it).
      clickTrackStateRef.current = session.clickTrack ?? null;
      if (isMobile) {
        setSelectedModelId(DEFAULT_MOBILE_MODEL_ID);
      } else if (session.metadata.modelProfileId) {
        setSelectedModelId(session.metadata.modelProfileId);
      }
      setCurrentTime(session.mixer.currentTime ?? 0);
      setSeparationPhase("completed");
      setDetectedSession(null);
      // ADR-0008: resuming lands on the Mix Tab, where playback lives
      setSelectedTab("mix");
    } catch (err) {
      setDecodeError("Failed to resume previous session.");
    } finally {
      setIsResumingSession(false);
    }
  };

  // ADR-0008 (ticket 04): the old Mix Tab purge routine, kept as the single
  // full-purge wipe — cancel auto-saver, drop the cached Session, clear the
  // saved Session from storage, and clear the in-memory Source Mix, Stems,
  // mixer levels, and playhead (handleClearSourceMix).
  const handlePurgeSession = async () => {
    autoSaverRef.current.cancel();
    cachedSessionRef.current = null;
    await clearActiveSession();
    handleClearSourceMix();
  };

  // Discard (Session Recovery, Separate Tab) is now a full purge: it reuses
  // the purge routine rather than duplicating the wipe. Clearing the
  // detected Session keeps the recovery prompt from re-rendering after the
  // purge, leaving a clean Separate Tab.
  const handleDiscardSession = async () => {
    setDetectedSession(null);
    await handlePurgeSession();
  };

  const handleMixerChange = (mixer: {
    stems: StemMixerStates;
    masterVolume: number;
    currentTime: number;
  }) => {
    // Mix Tab cohesion (ADR-0013): this bridge is mixer-and-Session only — the
    // live Playhead reaches the spine via onPlayheadChange below, so the
    // bridge never runs per frame and the Session save cadence is untouched.
    if (!cachedSessionRef.current) return;
    const updatedSession: DemuxifySession = {
      ...cachedSessionRef.current,
      // Mirror the live Click Track rail (ADR-0010 ticket 05): the lane is
      // domain-separate from the Stem mixer contract below.
      clickTrack:
        clickTrackStateRef.current ?? cachedSessionRef.current.clickTrack,
      mixer: {
        ...cachedSessionRef.current.mixer,
        stems: mixer.stems,
        masterVolume: mixer.masterVolume,
        currentTime: mixer.currentTime,
      },
    };
    cachedSessionRef.current = updatedSession;
    autoSaverRef.current.debounceSave(updatedSession);
  };

  const handleChangeFile = () => {
    fileInputRef.current?.click();
  };

  const handleExportDialogStateChange = (state: ExportDialogState) => {
    setExportDialogState(state);
  };

  // Re-lock (ticket 06): the Mix-tab rail's picker chose a Tempo Detector
  // candidate. The pass re-runs off the main thread with that tempo as the
  // hint — the same heavy-pass machinery as at decode, so the UI stays
  // responsive mid-relock — and the new Beat Grid replaces the old one only
  // when it arrives, which keeps clicks on the current grid until then.
  const handleChooseTempoCandidate = (bpm: number) => {
    if (!decodedSourceMix) return;
    if (beatClientRef.current) {
      // Abandon an analysis still in flight: one Tempo Detector pass at a
      // time, so a re-lock never competes with the pass it replaces.
      beatClientRef.current.cancel();
    }
    startTempoAnalysis(decodedSourceMix.buffer, bpm);
  };

  // Calibrate the Click (ticket 08): the tap strip's confirm hands the taps
  // over. The derivation is pure arithmetic (calibrateClickGrid): fewer than
  // 3 taps, or any gap under 0.25 s or over 2.5 s, are refused honestly —
  // nothing starts, and the strip already says why. Never a silent
  // half-calibration. Accepted taps re-lock through the same heavy-pass
  // machinery as at decode, with the derived BPM as the re-lock hint.
  const handleConfirmTapCalibration = (tapsSec: number[]) => {
    if (!decodedSourceMix) return;
    const outcome = calibrateClickGrid(tapsSec);
    if (outcome.kind !== "calibrated") return;
    if (beatClientRef.current) {
      beatClientRef.current.cancel();
    }
    pendingCalibrationRef.current = outcome;
    startTempoAnalysis(decodedSourceMix.buffer, outcome.bpm);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processAudioFile(file);
    }
  };

  const handleSeek = (seekTime: number) => {
    // Mix Tab cohesion (ADR-0013): the spine never writes the clock directly —
    // the engine's seek notifies its position, which lands on the app's
    // Playhead through the one onPlayheadChange channel below.
    // Shared spine (ADR-0008): scrubbing on the Mix Tab's spine drives the
    // same Stem Player engine through the transport bridge.
    transportActionsRef.current.seek(seekTime);
  };

  const handleStartSeparation = async () => {
    if (!decodedSourceMix) return;

    try {
      setSeparationPhase("downloading");
      setSeparationError(null);
      setSeparatedStems(null);

      if (!inferenceClientRef.current) {
        inferenceClientRef.current = new InferenceClient();
      }
      const client = inferenceClientRef.current;

      const activeProfile = getModelProfile(selectedModelId);
      const isTestEnv =
        typeof process !== "undefined" && process.env?.NODE_ENV === "test";

      await client.init({
        modelUrl: activeProfile.modelUrl,
        modelProfileId: activeProfile.id,
        useMock: isTestEnv,
        preferredBackend: capability?.isFallback ? "wasm" : undefined,
        onDownloadProgress: (p) => {
          setDownloadProgress(p);
          setSeparationPhase("downloading");
        },
      });

      setSeparationPhase("separating");

      const numChannels = decodedSourceMix.buffer.numberOfChannels;
      const audio: Float32Array[] = [];
      for (let c = 0; c < numChannels; c++) {
        audio.push(decodedSourceMix.buffer.getChannelData(c));
      }

      const result = await client.separate(
        audio,
        decodedSourceMix.buffer.sampleRate,
        {
          onChunkStart: (start) => {
            setChunkStart(start);
          },
          onChunkProgress: (p) => {
            setChunkProgress(p);
          },
        }
      );

      setSeparatedStems(result.stems);
      setSeparationPhase("completed");
      // Ticket 07 (ADR-0010 Amendment): the Beat Grid gets re-read where the
      // groove is isolated — but only when the Drums Stem actually carries
      // samples; with none, the decode-time Source Mix read already IS the
      // fallback grid and stays untouched. A Source Mix pass still in flight
      // is abandoned first (ticket 06's one-pass-at-a-time rule), and a
      // failing stem pass keeps the existing reading (non-fatal catch).
      const grooveChannels = result.stems.drums.filter(
        (channel) => channel.length > 0
      );
      if (grooveChannels.length > 0) {
        if (beatClientRef.current) {
          beatClientRef.current.cancel();
        }
        startTempoAnalysis(decodedSourceMix.buffer, undefined, result.stems);
      }
      // ADR-0008: Separation completes on the Mix Tab, ready for playback
      setSelectedTab("mix");

      const initialMixerState: SessionMixerState = {
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
      setRestoredMixerState(initialMixerState);

      const sessionToSave: DemuxifySession = {
        metadata: {
          id: `session-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          title: decodedSourceMix.metadata.fileName.replace(/\.[^/.]+$/, ""),
          filename: decodedSourceMix.metadata.fileName,
          duration: decodedSourceMix.metadata.duration,
          sampleRate: decodedSourceMix.metadata.sampleRate,
          size: decodedSourceMix.metadata.fileSize,
          modelProfileId: selectedModelId,
        },
        sourceMix: {
          channels: audio,
        },
        stems: result.stems,
        mixer: initialMixerState,
        tempo: tempoResultRef.current ?? undefined,
        clickTrack: clickTrackStateRef.current ?? undefined,
      };

      cachedSessionRef.current = sessionToSave;
      autoSaverRef.current.debounceSave(sessionToSave);
    } catch (err) {
      if (err instanceof Error && /cancelled/i.test(err.message)) {
        setSeparationPhase("idle");
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setSeparationError(message);
        setSeparationPhase("error");
      }
    }
  };

  const handleCancelSeparation = () => {
    if (inferenceClientRef.current) {
      inferenceClientRef.current.cancel();
    }
    setSeparationPhase("idle");
    setChunkProgress(null);
    setChunkStart(null);
    setDownloadProgress(null);
  };

  const stemsReady = separationPhase === "completed" && separatedStems !== null;
  const tabIsGated = (tabId: string) =>
    TAB_REGISTRY.some((tab) => tab.id === tabId && tab.gatedUntilStems) &&
    !stemsReady;
  // A gated Tab can never hold the stage; the shell falls back to Separate.
  const activeTab: string = tabIsGated(selectedTab) ? "separate" : selectedTab;

  const handleSelectTab = (tabId: string) => {
    if (tabIsGated(tabId)) {
      // Silent no-op (ADR-0009): the rail chip's bare reason line is already
      // the whole refusal answer, and the toast DOM surface is dead — no
      // notice is emitted at all. The stage never moves.
      return;
    }
    setSelectedTab(tabId);
  };

  return (
    <div className="bg-st-canvas min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Rail-hosted chrome (ADR-0009, ticket 02): the page-level header is dead at
          every breakpoint — identity and navigation now live in the single sticky Tab
          Rail block below, a brand row over the four-chip Tab row. */}

      {/* Full-bleed shell (artifact `.app`: no max-width; the Band always sits
          OVER the stage — main is one flex column at every width). */}
      <main className="flex-1 w-full px-2 sm:px-6 flex flex-col gap-3 sm:gap-4 md:gap-5">
        {/* Tab Band (ADR-0014 + 06b stitch.html port): ONE sticky block — brand
            cluster and the bordered chip-container with compact JetBrains-Mono
            chips share a row at md+ (stacked below-md), coral glow marks the
            ACTIVE chip; the mockup phantom utility cluster trails right. Sticky +
            z-30 pins the chrome; the blurred canvas backdrop keeps scrolling
            stage content from ghosting through. */}
        <nav
          aria-label="Tab Band"
          className="sticky top-0 z-30 flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2 pb-3.5 sm:py-2.5 sm:pb-4 overflow-hidden w-full backdrop-blur-md bg-background/95 md:bg-card/50"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6 shrink-0">
            <BrandUnit />
            {/* Debug mode marker (ticket 08): the flag is honest chrome — while
                the synthetic fixture is on the stage, the Band says so, so a
                preview can never be mistaken for a real upload. */}
            {debugSession && (
              <span className="font-mono text-[10px] tracking-widest uppercase text-st-coral whitespace-nowrap">
                Debug · synthetic media
              </span>
            )}
            <div
              data-testid="tab-band-chips"
              className="grid grid-cols-4 gap-1 w-full md:inline-grid md:w-auto md:gap-2 rounded border border-st-hairline bg-st-canvas p-1"
            >
              {TAB_REGISTRY.map((tab) => {
                const gated = tab.gatedUntilStems && !stemsReady;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-label={tab.title}
                    aria-current={active ? "true" : undefined}
                    aria-disabled={gated ? true : undefined}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-h-[${TAB_CHIP_MIN_TARGET_PX}px] min-w-[${TAB_CHIP_MIN_TARGET_PX}px] rounded uppercase font-mono text-[${TAB_CHIP_TYPE_PX}px] tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary text-white font-bold shadow-chip-glow" : "font-medium text-st-ink-dim hover:text-st-ink"} ${gated ? "opacity-50 text-muted-foreground" : ""}`.trim()}
                  >
                    <span className="whitespace-nowrap">{tab.title}</span>
                    {gated && (
                      <span className="font-mono text-[6px] sm:text-[9px] font-medium tracking-wide text-muted-foreground">
                        {TAB_GATING_REASON}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Mockup phantom chrome (06b, data-mockup-placeholder): the stitch
              mockup invented an engine status badge and an undo/redo/settings icon
              cluster. Per the user 2026-11-04 override they render as VERBATIM
              DEAD PLACEHOLDERS — no handlers, no state, aria-hidden so no phantom
              roles leak into the Band subtree; a later cleanup commit erases them. */}
          <div
            data-mockup-placeholder="true"
            aria-hidden="true"
            className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4"
          >
            <div className="hidden md:flex items-center gap-3 rounded border border-st-hairline bg-st-canvas px-3 py-1 font-mono text-[10px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-st-ok mr-1.5" />
                DSP WebAudio 44.1kHz
              </span>
              <span className="text-zinc-600">|</span>
              <span>{"LATENCY: <1.8ms"}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-300">BUFFERS: SYNCED</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded border border-transparent text-zinc-400 flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M3 10h10a5 5 0 0 1 5 5v2m0 0l-3-3m3 3l3-3M3 10l3-3M3 10l3 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="p-1.5 rounded border border-transparent text-zinc-400 flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M21 10H11a5 5 0 0 0-5 5v2m0 0l3-3m-3 3L3 14m18-4l-3-3m3 3l-3 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="p-1.5 rounded border border-transparent text-zinc-400 flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065 2.572c1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
            </div>
          </div>
        </nav>

        {/* Tab stage: four pinned Tab panels, always present in the DOM; the
            stage shows only the ACTIVE Tab panel (artifact `.stage` + `.panel`). */}
        <div className="relative flex-1 min-h-[340px] overflow-hidden">
          {/* Separate Tab: Session Recovery, Model Selector, Source Mix ingestion, Inference Engine */}
          <section
            role="region"
            aria-label="Separate Tab"
            className={tabPanelClass(false, activeTab === "separate")}
          >
            <section className="relative space-y-4">
              {/* Title zone (Stitch skin 03, agent fallback design from the spec mockup):
                  uppercase display title + tiny sans caption + bordered micro-chip carrying
                  the shipped mono meta line. The Grizzlython header zone's seam band - the
                  dashed hairline and the solid rule at sm+ - is DEAD (no wash-style rule
                  behind the words); copy survives verbatim. */}
              <div className="px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-4.5 sm:pb-5">
                <h2
                  className="font-display text-[15px] leading-[18px] font-bold uppercase tracking-[0.07em] text-st-ink sm:text-[22px] sm:leading-[26px] sm:tracking-[0.06em]"
                  style={BANNER_FONT}
                >
                  Separate Music Into Stems
                </h2>
                <p className="mt-1.5 sm:mt-2.5 text-[13px] leading-[20px] text-st-ink-dim sm:text-[15px] sm:leading-[23px] sm:max-w-[660px]">
                  Extract Vocals, Drums, Bass, and Other instruments locally in
                  your browser using neural network models.
                </p>
                <div className="mt-1.5 sm:mt-3 rounded-full bg-st-surface border border-st-hairline px-2.5 py-0.5 font-mono text-[9px] sm:text-[10px] leading-[11px] sm:leading-[13px] uppercase tracking-[0.14em] text-st-ink-dim">
                  HT-DEMUCS 4-STEM <span className="text-status-ok">·</span>{" "}
                  local onnx
                </div>
              </div>

              {/* Decoding Error Alert */}
              {decodeError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold">Unable to Decode Audio</h4>
                    <p className="mt-0.5 text-xs text-destructive/90">
                      {decodeError}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDecodeError(null)}
                    className="rounded border border-destructive/20 px-2 py-1 text-xs font-medium hover:bg-destructive/20 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Hidden File Input for Replace / Change actions */}
              <input
                ref={fileInputRef}
                type="file"
                id="app-source-mix-input"
                aria-label="Change Source Mix file"
                accept={
                  SUPPORTED_EXTENSIONS.join(",") +
                  "," +
                  SUPPORTED_MIME_TYPES.join(",")
                }
                className="sr-only"
                onChange={handleFileInputChange}
              />

              {/* Previous Session Recovery Prompt */}
              {detectedSession && !decodedSourceMix && !isDecoding && (
                <SessionRecovery
                  title={detectedSession.title}
                  duration={detectedSession.duration}
                  onResume={handleResumeSession}
                  onDiscard={handleDiscardSession}
                  isResuming={isResumingSession}
                />
              )}

              {/* Decoding In-Progress Indicator */}
              {isDecoding && (
                <div className="flex flex-col items-center justify-center rounded border border-border bg-card/60 p-12 text-center shadow-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Decoding Audio Buffer
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Extracting PCM data and computing peak envelopes for
                    waveform rendering...
                  </p>
                </div>
              )}

              {/* Model Profile Selector & Device Advisory */}
              {separationPhase === "idle" && (
                <ModelSelector
                  selectedModelId={selectedModelId}
                  onSelectModel={setSelectedModelId}
                  isMobile={isMobile}
                />
              )}

              {/* Render Source Mix Dropzone when no audio is loaded and not decoding */}
              {!isDecoding && !decodedSourceMix && (
                <SourceMixDropzone
                  onSourceMixSelected={handleSourceMixSelected}
                  selectedFile={selectedFile}
                  onClearFile={handleClearSourceMix}
                />
              )}

              {/* Render Decoded Source Mix: Metadata Card and Master Waveform */}
              {!isDecoding && decodedSourceMix && (
                <div className="space-y-4">
                  <SourceMixCard
                    metadata={decodedSourceMix.metadata}
                    onStartSeparation={handleStartSeparation}
                    onChangeFile={handleChangeFile}
                    onRemove={handleClearSourceMix}
                  />

                  {/* Separation Progress Card (Visible during downloading / separating / error) */}
                  <SeparationProgress
                    phase={separationPhase}
                    downloadProgress={downloadProgress}
                    chunkProgress={chunkProgress}
                    chunkStart={chunkStart}
                    modelProfile={getModelProfile(selectedModelId)}
                    error={separationError}
                    onCancel={handleCancelSeparation}
                    onRetry={handleStartSeparation}
                  />

                  {/* Tempo Detector status micro-line: agent-authored look
                      (ticket 01 FALLBACK RECORD: the OpenDesign run was lost
                      with the daemon, so this look comes from the agent and
                      is recorded on ticket 01, not an OD artifact). Ranked
                      candidates shown honestly: top reading plus
                      alternatives, never one BPM presented as certain. */}
                  {tempoAnalysis && (
                    <p
                      role="status"
                      aria-label="Tempo Detector reading"
                      className="-mt-1 font-mono text-xs tracking-wide text-muted-foreground"
                      style={{ fontFamily: MONO_FONT_STACK }}
                    >
                      {`Tempo Detector: ${tempoAnalysis.candidates[0].bpm.toFixed(1)} BPM`}
                      {tempoAnalysis.candidates.length > 1
                        ? ` | alternatives ${tempoAnalysis.candidates
                            .slice(1)
                            .map((c) => `${c.bpm.toFixed(1)} BPM`)
                            .join(" ")}`
                        : ""}
                    </p>
                  )}

                  {/* Stems Separated Banner (Visible on completion) */}
                  {separationPhase === "completed" && separatedStems && (
                    <div
                      role="region"
                      aria-label="Separation Complete"
                      className="rounded border border-status-ok/30 bg-status-ok/10 p-5 shadow-sm space-y-3"
                    >
                      <div className="flex items-center gap-2.5 text-status-ok">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <h3 className="font-display text-base font-semibold">
                          Separation Complete: 4 Discrete Stems Generated
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        {STEM_NAMES.map((stem) => (
                          <div
                            key={stem}
                            className="flex items-center gap-2 rounded border border-border bg-card/80 p-3 shadow-xs"
                          >
                            <Music
                              className={`h-4 w-4 shrink-0 text-stem-${stem}`}
                            />
                            <div>
                              <div className="text-xs font-semibold capitalize text-foreground">
                                {stem}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {separatedStems[
                                  stem
                                ][0]?.length.toLocaleString()}{" "}
                                samples
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </section>

          {/* Mix Tab: Stem Player (strips, mute/solo/volume, Time-Stretch & Pitch, transport) */}
          <section
            role="region"
            aria-label="Mix Tab"
            className={tabPanelClass(!stemsReady, activeTab === "mix")}
          >
            {separationPhase === "completed" &&
            separatedStems &&
            decodedSourceMix ? (
              <>
                {/* Master Waveform spine (ADR-0008): the Mix Tab owns the single
                    timeline surface; scrubbing it drives the Stem Player engine
                    through the transport bridge, and its position flows back on
                    the one Playhead channel (ADR-0013). */}
                <div className="pt-2">
                  <MasterWaveform
                    peaks={waveformPeaks}
                    audioBuffer={decodedSourceMix.buffer}
                    duration={decodedSourceMix.metadata.duration}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    height={96}
                  />
                </div>
                {/* Hand Calibration (ADR-0013, ticket 09): the lane welds
                    directly under the spine — same width, same time axis, no
                    card gap. Tapping stays a gesture against the axis the
                    user can already see; the decision contract is untouched. */}
                <div>
                  <BeatGridTapCalibration
                    duration={decodedSourceMix.metadata.duration}
                    onTapCalibration={handleConfirmTapCalibration}
                  />
                </div>
                <StemPlayer
                  stems={separatedStems}
                  sampleRate={decodedSourceMix.metadata.sampleRate}
                  duration={decodedSourceMix.metadata.duration}
                  sourceMixBuffer={decodedSourceMix.buffer}
                  masterPeaks={waveformPeaks}
                  initialMixerStates={restoredMixerState?.stems}
                  initialMasterVolume={restoredMixerState?.masterVolume}
                  initialCurrentTime={restoredMixerState?.currentTime}
                  onMixerChange={handleMixerChange}
                  // Mix Tab cohesion (ADR-0013): the spine's clock is fed by
                  // the engine's one position subscription, not by the mixer
                  // bridge — press play with no mixer event and it walks.
                  onPlayheadChange={(timeSec) => setCurrentTime(timeSec)}
                  sourceMixTitle={decodedSourceMix.metadata.fileName}
                  exportDialogHosted
                  onExportDialogState={handleExportDialogStateChange}
                  onTransportControls={(controls) => {
                    transportActionsRef.current = controls;
                  }}
                  masterWaveformHosted
                  // Click Track rail (ADR-0010, ticket 04): the Beat Grid comes
                  // straight off the Tempo Detector, and the rail reports its own
                  // state out to the app. Domain-separate: the four StemName
                  // identities and the mixer contract are untouched.
                  beatGrid={tempoAnalysis?.beatGrid}
                  clickTrackBpm={
                    tempoAnalysis ? tempoAnalysis.analyzedBpm : null
                  }
                  // Ticket 06: the ranked candidates drive the rail's honest
                  // readout (top + alternatives with confidence) and its
                  // picker, which re-locks the Beat Grid off the main thread.
                  tempoCandidates={tempoAnalysis?.candidates}
                  onChooseTempoCandidate={handleChooseTempoCandidate}
                  // Calibrate the Click (ticket 08): when the Beat Grid was
                  // anchored by hand, the rail says "calibrated by hand" —
                  // never an auto reading for a by-hand decision.
                  clickCalibration={clickCalibration}
                  onClickTrackState={(state) => {
                    clickTrackStateRef.current = state;
                  }}
                  initialClickTrack={clickTrackStateRef.current ?? undefined}
                />
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  Mix
                </h3>
                <p className="text-sm text-muted-foreground">
                  {TAB_GATING_REASON}
                </p>
              </div>
            )}
          </section>

          {/* Export Tab: Export panel mounted at the app level (inline, no modal) */}
          <section
            role="region"
            aria-label="Export Tab"
            className={tabPanelClass(!stemsReady, activeTab === "export")}
          >
            {separationPhase === "completed" &&
            separatedStems &&
            decodedSourceMix ? (
              <>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <h3 className="font-display text-[15px] leading-[18px] font-bold uppercase tracking-[0.07em] text-st-ink">
                    Export
                  </h3>
                  <p className="text-sm text-st-ink-dim">
                    The Export panel is always here — no action to click.
                  </p>
                  <div className="rounded-full bg-st-surface border border-st-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-st-ink-dim">
                    WAV · MP3 · ZIP
                  </div>
                </div>
                <div className="pt-1">
                  <ExportDialog
                    isOpen
                    stems={separatedStems}
                    sampleRate={decodedSourceMix.metadata.sampleRate}
                    sourceMixTitle={decodedSourceMix.metadata.fileName}
                    initialMixerStates={exportDialogState?.mixerStates}
                    initialMasterVolume={exportDialogState?.masterVolume}
                    activeTimeStretch={exportDialogState?.timeStretch}
                    clickTrackBeatGrid={tempoAnalysis?.beatGrid}
                    clickTrackSettings={clickTrackStateRef.current ?? undefined}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5 shrink-0">
                <h3 className="font-display text-[15px] leading-[18px] font-bold uppercase tracking-[0.07em] text-st-ink">
                  Export
                </h3>
                <p className="text-sm text-st-ink-dim">{TAB_GATING_REASON}</p>
              </div>
            )}
          </section>

          {/* System Tab: WebGPU status, Fallback Advisory, Model Cache status, session info, inline diagnostics */}
          <section
            role="region"
            aria-label="System Tab"
            className={tabPanelClass(false, activeTab === "system")}
          >
            {/* System Tab title zone (Stitch skin 05): the Grizzlython
                header band is DEAD outright — chrome strip, mascot faces,
                and the grz accessible names are retired. The Tab wears the
                mockup's title-zone pattern like its sibling panels; the
                status chips below stay honest — chips survive, chrome dies. */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <h3 className="font-display text-[15px] leading-[18px] font-bold uppercase tracking-[0.07em] text-st-ink">
                System
              </h3>
              <p className="text-sm text-st-ink-dim">
                Hardware acceleration, Model Cache and on-device diagnostics.
              </p>
            </div>
            <div className="pt-1 space-y-3">
              {/* Identity statement (ADR-0009 story 12): the pinned mobile
                  lockup line carries the reduced claim; the System Tab's mono
                  identity <p> died outright with the band (ticket 05) — the
                  System region must not resurrect it (absence-pinned). */}
              <WebGPUStatusBadge
                capability={capability}
                isLoading={isDetectingWebGPU}
              />
              {capability?.isFallback && (
                <FallbackAdvisory capability={capability} />
              )}
              <ModelCacheStatus />
              {detectedSession && !decodedSourceMix && (
                <p className="text-xs text-muted-foreground">
                  Saved session: {detectedSession.title} (
                  {detectedSession.duration.toFixed(1)}s) — resume it from the
                  Separate Tab.
                </p>
              )}
            </div>
            <DiagnosticsPanel />
          </section>
        </div>
      </main>

      {/* Footer transport (06c stitch.html port): the mockup master transport
          bar renders verbatim as a DEAD PLACEHOLDER — data-mockup-placeholder
          + aria-hidden on the bar itself; no handlers, no state; a later
          cleanup commit erases it. The flat tan hairline cap (ticket 05) is
          its border-t, same token as the Band chip dividers. */}
      <footer
        data-mockup-placeholder="true"
        aria-hidden="true"
        className="w-full flex items-center justify-between shrink-0 z-30 border-t border-st-hairline bg-st-panel px-3 sm:px-6 py-3 sm:py-2 sm:h-16"
      >
        <div className="flex items-center gap-4 w-72 shrink-0">
          <div className="font-mono bg-st-canvas px-3 py-1.5 rounded border border-st-hairline flex items-baseline gap-1.5">
            <span className="text-white text-base font-bold tracking-wider">
              00:51
            </span>
            <span className="text-zinc-500 text-xs">/</span>
            <span className="text-zinc-400 text-xs">03:35</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase tracking-widest text-st-ok flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 shadow-[0_0_6px_#34d399]" />
              SYNC READY
            </span>
            <span className="text-[9px] font-mono text-zinc-500">
              4 STEMS PHASE-LOCKED
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 text-zinc-400 bg-st-surface rounded border border-st-hairline flex items-center justify-center">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="p-2 text-zinc-300 bg-st-surface rounded border border-st-hairline flex items-center justify-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
            </svg>
          </div>
          <div className="w-11 h-11 rounded-full bg-st-coral text-white flex items-center justify-center shadow-play-glow">
            <svg
              className="w-5 h-5 ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          </div>
          <div className="p-2 text-zinc-300 bg-st-surface rounded border border-st-hairline flex items-center justify-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
            </svg>
          </div>
          <div className="px-2.5 py-1.5 bg-st-surface border border-st-hairline rounded text-zinc-400 font-mono text-[10px] font-semibold flex items-center justify-center">
            TAP
          </div>
        </div>
        <div className="flex items-center gap-4 w-72 shrink-0 justify-end">
          <div className="flex items-center gap-1">
            <div className="flex flex-col gap-0.5">
              <span className="inline-block w-1.5 h-1 bg-zinc-700" />
              <span className="inline-block w-1.5 h-1 bg-emerald-500" />
              <span className="inline-block w-1.5 h-1 bg-emerald-500" />
              <span className="inline-block w-1.5 h-1 bg-emerald-400" />
              <span className="inline-block w-1.5 h-1 bg-emerald-400" />
              <span className="inline-block w-1.5 h-1 bg-emerald-400" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="inline-block w-1.5 h-1 bg-zinc-700" />
              <span className="inline-block w-1.5 h-1 bg-zinc-700" />
              <span className="inline-block w-1.5 h-1 bg-emerald-500" />
              <span className="inline-block w-1.5 h-1 bg-emerald-400" />
              <span className="inline-block w-1.5 h-1 bg-emerald-400" />
              <span className="inline-block w-1.5 h-1 bg-emerald-400" />
            </div>
            <span className="font-mono text-[9px] text-zinc-500 ml-1">
              0 dB
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-400 uppercase font-semibold">
              Master
            </span>
            <div className="w-20 h-1 rounded bg-st-hairline relative">
              <span className="absolute right-0 top-[-2px] w-2 h-2 rounded-full bg-st-coral" />
            </div>
            <span className="font-mono text-[10px] text-zinc-200 font-bold w-7 text-right">
              100%
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
