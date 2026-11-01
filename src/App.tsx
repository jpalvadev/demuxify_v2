import React, { useEffect, useState, useRef, ChangeEvent } from "react";
import {
  AlertCircle,
  Loader2,
  CheckCircle2,
  Music,
  SkipBack,
  Play,
  Pause,
} from "lucide-react";
import { Header } from "./components/Header";
import { SourceMixDropzone } from "./components/SourceMixDropzone";
import { FallbackAdvisory } from "./components/FallbackAdvisory";
import { SourceMixCard } from "./components/SourceMixCard";
import { MasterWaveform } from "./components/MasterWaveform";
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
import { ToastContainer } from "./components/Toast";
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
import { DownloadProgress } from "./lib/modelCache";
import { StemName, STEM_NAMES } from "./lib/chunkOverlapAdd";
import {
  loadActiveSession,
  hasActiveSession,
  clearActiveSession,
  createSessionAutoSaver,
  DemuxifySession,
  SessionMixerState,
} from "./lib/sessionStore";
import { StemMixerStates } from "./lib/stemPlayerEngine";

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

// Tab Shell registry (ADR-0007): one registry drives the desktop left rail,
// the mobile top strip, and the five pinned Tab panels.
function formatTransportTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

interface TabEntry {
  id: string;
  title: string;
  gatedUntilStems: boolean;
}

const TAB_REGISTRY: TabEntry[] = [
  { id: "separate", title: "Separate", gatedUntilStems: false },
  { id: "listen", title: "Listen", gatedUntilStems: true },
  { id: "mix", title: "Mix", gatedUntilStems: true },
  { id: "export", title: "Export", gatedUntilStems: true },
  { id: "system", title: "System", gatedUntilStems: false },
];

const TAB_GATING_REASON = "no Stems yet";

const tabPanelClass = (gated: boolean, active: boolean) =>
  `rounded-2xl border border-border/60 bg-card/40 p-4 transition-colors ${
    active ? "border-primary/70 bg-card/80" : ""
  } ${gated ? "opacity-50" : ""}`.trim();

export const App: React.FC = () => {
  // Dark-only contract (ticket 09): no theme state — html keeps `dark` forever
  // and there is no light-token override block to switch into.
  const [capability, setCapability] = useState<WebGPUCapability | null>(null);
  const [isDetectingWebGPU, setIsDetectingWebGPU] = useState(true);

  // Model Profile State
  const [isMobile] = useState(() => isMobileDevice());
  const [selectedModelId, setSelectedModelId] = useState<ModelId>(
    () => getDefaultModelProfile().id
  );

  // Source Mix State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [decodedSourceMix, setDecodedSourceMix] =
    useState<DecodedSourceMix | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<WaveformPeaks | null>(
    null
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Inference Separation State
  const [separationPhase, setSeparationPhase] =
    useState<SeparationPhase>("idle");
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
  > | null>(null);

  // Session Recovery & Persistence State
  const [detectedSession, setDetectedSession] = useState<{
    title: string;
    duration: number;
  } | null>(null);
  const [isResumingSession, setIsResumingSession] = useState(false);
  const [restoredMixerState, setRestoredMixerState] =
    useState<SessionMixerState | null>(null);

  // Export Tab panel state (Tab Shell): fed live from the Stem Player bridge.
  const [exportDialogState, setExportDialogState] =
    useState<ExportDialogState | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Transport bridge: the Listen Tab's Transport row drives the Stem Player
  // engine (registered by StemPlayer on init, ADR-0007 Tab Shell bridge).
  const transportActionsRef = useRef<TransportControls>({
    play: () => {},
    pause: () => {},
    seekToStart: () => {},
    seek: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inferenceClientRef = useRef<InferenceClient | null>(null);
  const cachedSessionRef = useRef<DemuxifySession | null>(null);
  const autoSaverRef = useRef(createSessionAutoSaver(600));

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

  const processAudioFile = async (file: File) => {
    setSelectedFile(file);
    setIsDecoding(true);
    setDecodeError(null);
    setCurrentTime(0);
    setSeparationPhase("idle");
    setSeparatedStems(null);

    try {
      const decoded = await decodeAudio(file);
      const peaks = computeWaveformPeaks(decoded.buffer);
      setDecodedSourceMix(decoded);
      setWaveformPeaks(peaks);
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
      if (isMobile) {
        setSelectedModelId(DEFAULT_MOBILE_MODEL_ID);
      } else if (session.metadata.modelProfileId) {
        setSelectedModelId(session.metadata.modelProfileId);
      }
      setCurrentTime(session.mixer.currentTime ?? 0);
      setSeparationPhase("completed");
      setDetectedSession(null);
    } catch (err) {
      setDecodeError("Failed to resume previous session.");
    } finally {
      setIsResumingSession(false);
    }
  };

  const handleDiscardSession = async () => {
    setDetectedSession(null);
    cachedSessionRef.current = null;
    autoSaverRef.current.cancel();
    await clearActiveSession();
  };

  const handlePurgeSession = async () => {
    autoSaverRef.current.cancel();
    cachedSessionRef.current = null;
    await clearActiveSession();
    handleClearSourceMix();
  };

  const handleMixerChange = (mixer: {
    stems: StemMixerStates;
    masterVolume: number;
    currentTime: number;
  }) => {
    // Shared spine (ADR-0007): mirror the live playhead so the Mix Tab's
    // mini spine and the Listen Tab readout stay in lockstep with playback.
    setCurrentTime(mixer.currentTime);
    if (!cachedSessionRef.current) return;
    const updatedSession: DemuxifySession = {
      ...cachedSessionRef.current,
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

  const handleExportDialogOpen = (state: ExportDialogState) => {
    setExportDialogState(state);
    setIsExportDialogOpen(true);
  };

  const handleExportDialogStateChange = (state: ExportDialogState) => {
    setExportDialogState(state);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processAudioFile(file);
    }
  };

  const handleSeek = (seekTime: number) => {
    setCurrentTime(seekTime);
    // Shared spine (ADR-0007): scrubbing on either Tab's spine drives the
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
  const activeTab: string = stemsReady ? "listen" : "separate";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Tab rail: horizontal top strip on mobile portrait, vertical left rail at md+ */}
        <nav
          aria-label="Tab rail"
          className="flex items-center justify-center flex-wrap gap-2 w-full md:w-56 md:flex-col md:no-wrap md:justify-start md:items-stretch pb-3"
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
                className={`inline-flex flex-col items-center justify-center gap-1.5 rounded-lg px-4 py-3.5 min-h-[44px] min-w-[44px] md:w-full text-sm font-semibold tracking-wide text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${gated ? "opacity-50 text-muted-foreground" : ""} ${active ? "bg-primary/10 border-primary/60 shadow-sm" : ""}`.trim()}
              >
                {tab.title}
                {gated && (
                  <span className="text-xs text-muted-foreground">
                    {TAB_GATING_REASON}
                  </span>
                )}
              </button>
            );
          })}

          {/* Toast stack (Tab Shell port, data-od-id="toast-stack"): notices
              stack at the rail bottom (left column on desktop, below the top
              strip on mobile portrait) instead of floating over content. */}
          <ToastContainer />
        </nav>

        {/* Tab stage: five pinned Tab panels, always present in the DOM */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Separate Tab: Session Recovery, Model Selector, Source Mix ingestion, Inference Engine */}
          <section
            role="region"
            aria-label="Separate Tab"
            className={tabPanelClass(false, activeTab === "separate")}
          >
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Separate Music Into Stems
                </h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Extract Vocals, Drums, Bass, and Other instruments locally in
                  your browser using neural network models.
                </p>
              </div>

              {/* Decoding Error Alert */}
              {decodeError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
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
                    className="rounded-lg border border-destructive/20 px-2 py-1 text-xs font-medium hover:bg-destructive/20 transition-colors"
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
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/60 p-12 text-center shadow-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <h3 className="text-base font-semibold text-foreground">
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

                  {/* Stems Separated Banner (Visible on completion) */}
                  {separationPhase === "completed" && separatedStems && (
                    <div
                      role="region"
                      aria-label="Separation Complete"
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-sm space-y-3"
                    >
                      <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <h3 className="text-base font-semibold">
                          Separation Complete: 4 Discrete Stems Generated
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        {STEM_NAMES.map((stem) => (
                          <div
                            key={stem}
                            className="flex items-center gap-2 rounded-xl border border-border bg-card/80 p-3 shadow-xs"
                          >
                            <Music className="h-4 w-4 text-primary shrink-0" />
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

          {/* Listen Tab: shared Master Waveform spine + playback transport */}
          <section
            role="region"
            aria-label="Listen Tab"
            className={tabPanelClass(!stemsReady, activeTab === "listen")}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Listen
              </h3>
              <p className="text-sm text-muted-foreground">
                {waveformPeaks && decodedSourceMix
                  ? "Scrub the shared spine here; the playhead stays put when switching Tabs."
                  : TAB_GATING_REASON}
              </p>
            </div>
            {waveformPeaks && decodedSourceMix && (
              <div className="pt-1 space-y-3">
                <MasterWaveform
                  peaks={waveformPeaks}
                  audioBuffer={decodedSourceMix.buffer}
                  duration={decodedSourceMix.metadata.duration}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />

                {/* Transport row (Tab Shell port): dedicated Seek/Play/Pause + mono readout */}
                <div
                  role="group"
                  aria-label="Transport"
                  className="flex flex-wrap items-center gap-2"
                >
                  <button
                    type="button"
                    aria-label="Seek to Start"
                    title="Seek to start"
                    onClick={() => {
                      transportActionsRef.current.seekToStart();
                      handleSeek(0);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                  >
                    <SkipBack className="h-4 w-4" />
                    <span className="font-mono uppercase text-[9px] font-bold tracking-wider">
                      Seek
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Play"
                    title="Play (Space)"
                    onClick={() => transportActionsRef.current.play()}
                    className="flex h-11 px-4 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span className="font-mono text-[10px] font-bold uppercase">
                      Play
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Pause"
                    title="Pause (Space)"
                    onClick={() => transportActionsRef.current.pause()}
                    className="flex h-11 px-4 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 text-foreground hover:bg-secondary transition-all"
                  >
                    <Pause className="h-4 w-4 fill-current" />
                    <span className="font-mono text-[10px] font-bold uppercase">
                      Pause
                    </span>
                  </button>
                </div>
                <p className="font-mono font-extrabold tracking-tight text-lg text-foreground">
                  <span>{formatTransportTime(currentTime)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span>
                    {formatTransportTime(decodedSourceMix.metadata.duration)}
                  </span>
                </p>
              </div>
            )}
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
                {/* Shared Master Waveform spine port: mini overview, playhead
                    locked to the Listen Tab spine (data-od-id="spine-mini") */}
                <div className="pt-2">
                  <MasterWaveform
                    peaks={waveformPeaks}
                    audioBuffer={decodedSourceMix.buffer}
                    duration={decodedSourceMix.metadata.duration}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    height={84}
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
                  onPurgeSession={handlePurgeSession}
                  sourceMixTitle={decodedSourceMix.metadata.fileName}
                  onExportDialogOpen={handleExportDialogOpen}
                  onExportDialogState={handleExportDialogStateChange}
                  onTransportControls={(controls) => {
                    transportActionsRef.current = controls;
                  }}
                  masterWaveformHosted
                />
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
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
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                    Export
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Use the Export Stems action to open the Export panel.
                  </p>
                </div>
                <div className="pt-1">
                  <ExportDialog
                    isOpen={isExportDialogOpen}
                    onClose={() => setIsExportDialogOpen(false)}
                    stems={separatedStems}
                    sampleRate={decodedSourceMix.metadata.sampleRate}
                    sourceMixTitle={decodedSourceMix.metadata.fileName}
                    initialMixerStates={exportDialogState?.mixerStates}
                    initialMasterVolume={exportDialogState?.masterVolume}
                    activeTimeStretch={exportDialogState?.timeStretch}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  Export
                </h3>
                <p className="text-sm text-muted-foreground">
                  {TAB_GATING_REASON}
                </p>
              </div>
            )}
          </section>

          {/* System Tab: WebGPU status, Fallback Advisory, Model Cache status, session info, inline diagnostics */}
          <section
            role="region"
            aria-label="System Tab"
            className={tabPanelClass(false, activeTab === "system")}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                System
              </h3>
              <p className="text-sm text-muted-foreground">
                Hardware acceleration, Model Cache and on-device diagnostics.
              </p>
            </div>
            <div className="pt-1 space-y-3">
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

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <p>
          Demuxify Web • 100% Client-Side Audio Source Separation • Powered by
          Client Neural Inference &amp; WebGPU
        </p>
      </footer>
    </div>
  );
};

export default App;
