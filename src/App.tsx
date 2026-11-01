import React, {
  useEffect,
  useState,
  useRef,
  ChangeEvent,
  createElement,
} from "react";
import { AlertCircle, Loader2, CheckCircle2, Music } from "lucide-react";
import { BrandUnit } from "./components/BrandUnit";
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
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { grz01, grz02, grzNames, faceElements } from "./lib/grizzly";
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

const TAB_GATING_REASON = "no Stems yet";

const tabPanelClass = (gated: boolean, active: boolean) =>
  // Tab Shell stage invariant (artifact `.panel` + `.panel.act`): every Tab panel
  // stays in the DOM, but only the ACTIVE Tab's panel paints — the rest are
  // display-hidden inside the stage.
  gated || !active
    ? "hidden"
    : "absolute inset-0 overflow-y-auto overflow-x-hidden rounded-none border border-muted-foreground/60 bg-card/80 p-4 sm:px-6 sm:py-6 transition-colors";

export const App: React.FC = () => {
  // Dark-only contract (ticket 09): no theme state — html keeps `dark` forever
  // and there is no light-token override block to switch into.
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
    // Shared spine (ADR-0008): mirror the live playhead so the Mix Tab's
    // spine readout stays in lockstep with playback.
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
    <div className="grizzly-grid min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Rail-hosted chrome (ADR-0009, ticket 02): the page-level header is dead at
          every breakpoint — identity and navigation now live in the single sticky Tab
          Rail block below, a brand row over the four-chip Tab row. */}

      {/* Full-bleed shell (artifact `.app`: no max-width; rail + stage fill the
          viewport; at md+ the rail is a fixed column beside the fluid stage). */}
      <main className="flex-1 w-full px-2 sm:px-6 flex flex-col gap-4 md:flex-row md:gap-5">
        {/* Tab rail: ONE sticky top block at every breakpoint (ADR-0009 ticket 02).
            Mobile portrait: brand row (col-span-4) over the four-chip Tab row inside
            this same block; at md+ it becomes the fixed vertical rail column beside
            the stage. Sticky + z-30 replaces the dead page-level header's pinning;
            mobile paints the header's old chrome backdrop so scrolling stage content
            never ghosts through the pinned block. */}
        <nav
          aria-label="Tab rail"
          className="sticky top-0 z-30 grid grid-cols-4 gap-1 items-stretch py-2.5 pb-4 overflow-hidden w-full backdrop-blur-md bg-background/95 md:bg-card/50 sm:grid-cols-[112px_112px_112px_112px] md:grid-cols-[112px_112px_112px_112px] md:w-[250px] lg:w-[280px] md:flex md:flex-col md:no-wrap md:justify-start md:items-start md:gap-2.5 md:border-r md:border-grz-600/40"
        >
          {/* Brand Unit at the rail head: same lockup everywhere; on mobile the col-span-4
              puts it on its own row above the four chips; the mono tagline line is rail-hosted
              only (hidden md:block — the mobile lockup stays reduced at ~108px total). */}
          <BrandUnit />
          {TAB_REGISTRY.map((tab) => {
            const gated = tab.gatedUntilStems && !stemsReady;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={tab.title}
                aria-current={active ? "true" : undefined}
                onClick={() => handleSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-none px-[3px] py-2 min-h-[44px] min-w-[44px] text-[7px] sm:text-[9px] md:text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border border-grz-600/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full md:px-3 md:py-2.5 md:text-sm md:flex-row md:justify-start md:items-center md:gap-3 ${gated ? "opacity-50 text-muted-foreground" : ""} ${active ? "bg-primary text-primary-foreground border-primary" : ""}`.trim()}
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
              {/* Grizzlython header zone (grz-03, OpenDesign run 7 `separate-header-grizzly.html`
                  via the design-system-bold plugin): the band is an IN-FLOW slim rule, never a
                  wash behind the words. Mobile portrait: a 44px coral→0 gradient strip with a 1px
                  DASHED tan hairline seam that carries NO type. Desktop (sm+): FLAT SOLID 40px
                  coral rule carrying only a 9px ink mono tagline (tracking 0.14em) plus a 6×12
                  ink tick — the active rail chip's `bg-primary` + cream pairing flipped to ink-on-coral.
                  The UPPERCASE display title is the card's FIRST LINE OF TYPE under the seam:
                  15px / leading-18 / 0.07em mobile, 22px / leading-26 / 0.06em desktop, cream on
                  canvas. Below it a tan-2 mono meta line (10px / 0.14em) with a peach state pip,
                  then the subtitle as cream body copy (13/leading-20 mobile, 15/leading-23 desktop,
                  660px measure). Vertical rhythm per the sheet: 40 · 1 · 16 · 26 · 12 · 13 · 14 ·
                  46 · 20 desktop, 44 · 1 · 14 · 18 · 6 · 11 · 10 · 60 · 14 mobile. */}
              <div className="border-t-[1px] border-dashed sm:border-solid border-muted-foreground/60 px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-4.5 sm:pb-5">
                <h2
                  className="font-display text-[15px] leading-[18px] font-bold uppercase tracking-[0.07em] text-foreground sm:text-[22px] sm:leading-[26px] sm:tracking-[0.06em]"
                  style={BANNER_FONT}
                >
                  Separate Music Into Stems
                </h2>
                <div className="mt-1.5 sm:mt-3 font-mono text-[10px] leading-[11px] sm:leading-[13px] uppercase tracking-[0.14em] text-muted-foreground">
                  HT-DEMUCS 4-STEM <span className="text-status-ok">·</span>{" "}
                  local onnx
                </div>
                <p className="mt-2.5 sm:mt-3.5 text-[13px] leading-[20px] text-foreground sm:text-[15px] sm:leading-[23px] sm:max-w-[660px]">
                  Extract Vocals, Drums, Bass, and Other instruments locally in
                  your browser using neural network models.
                </p>
              </div>

              {/* Decoding Error Alert */}
              {decodeError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-none border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
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
                    className="rounded-none border border-destructive/20 px-2 py-1 text-xs font-medium hover:bg-destructive/20 transition-colors"
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
                <div className="flex flex-col items-center justify-center rounded-none border border-border bg-card/60 p-12 text-center shadow-sm">
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

                  {/* Stems Separated Banner (Visible on completion) */}
                  {separationPhase === "completed" && separatedStems && (
                    <div
                      role="region"
                      aria-label="Separation Complete"
                      className="rounded-none border border-status-ok/30 bg-status-ok/10 p-5 shadow-sm space-y-3"
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
                            className="flex items-center gap-2 rounded-none border border-border bg-card/80 p-3 shadow-xs"
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
                    timeline surface; scrubbing it drives the Stem Player playhead. */}
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
                  sourceMixTitle={decodedSourceMix.metadata.fileName}
                  exportDialogHosted
                  onExportDialogState={handleExportDialogStateChange}
                  onTransportControls={(controls) => {
                    transportActionsRef.current = controls;
                  }}
                  masterWaveformHosted
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
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                    Export
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The Export panel is always here — no action to click.
                  </p>
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
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
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
            {activeTab === "system" ? (
              /* System-Tab Grizzly band (grz-11/13/15/18, grizzlython-skin):
                  the app's header band re-homed into the System Tab — it runs
                  ONLY while this Tab is the active stage panel, is chrome
                  (bordered in-flow strip, chrome-0 radius, grz-600 hairline),
                  and is never a modal dialog. Two named faces flank the Tab
                  title: grz-01 Demuxer (round ears, broad snout, lowered brows)
                  and grz-02 Mixer (smaller ears, cocked brow, carries a machete). */
              <div
                data-testid="header-band"
                className="grid items-center gap-3 rounded-none border border-grz-600/40 bg-card/40 px-3 py-2 mb-3.5"
              >
                <h2
                  className="font-display text-[15px] leading-[18px] font-bold uppercase tracking-[0.07em] text-foreground sm:text-[22px] sm:leading-[26px] sm:tracking-[0.06em]"
                  style={BANNER_FONT}
                >
                  System
                </h2>
                <span
                  data-testid="header-band-face"
                  aria-label={`grz-01 — ${grzNames.grz01}`}
                  className="inline-flex w-7 h-7 pointer-events-none"
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full"
                    role="presentation"
                    aria-hidden="true"
                  >
                    {faceElements(grz01).map((el) =>
                      createElement(el.tag, el.attrs)
                    )}
                  </svg>
                </span>
                <span
                  data-testid="header-band-face"
                  aria-label={`grz-02 — ${grzNames.grz02}`}
                  className="inline-flex w-7 h-7 pointer-events-none"
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full"
                    role="presentation"
                    aria-hidden="true"
                  >
                    {faceElements(grz02).map((el) =>
                      createElement(el.tag, el.attrs)
                    )}
                  </svg>
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  System
                </h3>
                <p className="text-sm text-muted-foreground">
                  Hardware acceleration, Model Cache and on-device diagnostics.
                </p>
              </div>
            )}
            <div className="pt-1 space-y-3">
              {/* Identity statement on mobile (ADR-0009 story 12): the pinned mobile block
                  carries the reduced lockup without the tagline, so the System Tab carries
                  the mono identity line instead. */}
              <p
                className="font-mono text-xs font-medium tracking-wide text-muted-foreground"
                style={{ fontFamily: MONO_FONT_STACK }}
              >
                Client-Side Stem Separation
              </p>
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

      {/* Footer (ADR-0009): the red gradient slab and the 2px warn rule died
          with the hero band; the page ends flat on one tan hairline — the
          same token as the rail chip dividers and the System band border. */}
      <footer className="w-full block border-t border-grz-600/40 py-3 text-center text-[10px] text-muted-foreground">
        <p>
          <span className="block">
            Demuxify Web • 100% Client-Side Audio Source Separation
          </span>
          <span className="block">
            Powered by Client Neural Inference &amp; WebGPU
          </span>
        </p>
      </footer>
    </div>
  );
};

export default App;
