import React, { useEffect, useState, useRef, ChangeEvent } from 'react';
import { AlertCircle, Loader2, CheckCircle2, Music } from 'lucide-react';
import { Header } from './components/Header';
import { SourceMixDropzone } from './components/SourceMixDropzone';
import { FallbackAdvisory } from './components/FallbackAdvisory';
import { SourceMixCard } from './components/SourceMixCard';
import { MasterWaveform } from './components/MasterWaveform';
import { StemPlayer } from './components/StemPlayer';
import { SessionRecovery } from './components/SessionRecovery';
import { SeparationProgress, SeparationPhase } from './components/SeparationProgress';
import { ToastContainer } from './components/Toast';
import { detectWebGPUCapability, WebGPUCapability } from './lib/webgpu';
import { decodeAudio, DecodedSourceMix } from './lib/audioDecoder';
import { computeWaveformPeaks, WaveformPeaks } from './lib/waveformPeaks';
import { InferenceClient, ChunkProgress } from './lib/inferenceClient';
import { DownloadProgress } from './lib/modelCache';
import { StemName, STEM_NAMES } from './lib/chunkOverlapAdd';
import {
  loadActiveSession,
  hasActiveSession,
  clearActiveSession,
  createSessionAutoSaver,
  DemuxifySession,
  SessionMixerState,
} from './lib/sessionStore';
import { StemMixerStates } from './lib/stemPlayerEngine';

const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'];
const SUPPORTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
  'audio/*',
];

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [capability, setCapability] = useState<WebGPUCapability | null>(null);
  const [isDetectingWebGPU, setIsDetectingWebGPU] = useState(true);

  // Source Mix State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [decodedSourceMix, setDecodedSourceMix] = useState<DecodedSourceMix | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<WaveformPeaks | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Inference Separation State
  const [separationPhase, setSeparationPhase] = useState<SeparationPhase>('idle');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(null);
  const [separationError, setSeparationError] = useState<string | null>(null);
  const [separatedStems, setSeparatedStems] = useState<Record<StemName, Float32Array[]> | null>(null);

  // Session Recovery & Persistence State
  const [detectedSession, setDetectedSession] = useState<{ title: string; duration: number } | null>(null);
  const [isResumingSession, setIsResumingSession] = useState(false);
  const [restoredMixerState, setRestoredMixerState] = useState<SessionMixerState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inferenceClientRef = useRef<InferenceClient | null>(null);
  const cachedSessionRef = useRef<DemuxifySession | null>(null);
  const autoSaverRef = useRef(createSessionAutoSaver(600));

  useEffect(() => {
    let isMounted = true;

    async function probeCapability() {
      try {
        const result = await detectWebGPUCapability();
        if (isMounted) {
          setCapability(result);
        }
      } catch (err) {
        if (isMounted) {
          setCapability({
            supported: false,
            isFallback: true,
            errorReason: `WebGPU detection failed: ${err instanceof Error ? err.message : String(err)}`,
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
      inferenceClientRef.current?.terminate();
      autoSaverRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const processAudioFile = async (file: File) => {
    setSelectedFile(file);
    setIsDecoding(true);
    setDecodeError(null);
    setCurrentTime(0);
    setSeparationPhase('idle');
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
    setSeparationPhase('idle');
    setSeparatedStems(null);
    setDownloadProgress(null);
    setChunkProgress(null);
    setSeparationError(null);
    setRestoredMixerState(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const numChannels = session.sourceMix.channels.length;
      const length = session.sourceMix.channels[0]?.length ?? 0;
      const buffer = audioCtx.createBuffer(numChannels, length, session.metadata.sampleRate);
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
      setCurrentTime(session.mixer.currentTime ?? 0);
      setSeparationPhase('completed');
      setDetectedSession(null);
    } catch (err) {
      setDecodeError('Failed to resume previous session.');
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

  const handleMixerChange = (mixer: { stems: StemMixerStates; masterVolume: number; currentTime: number }) => {
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

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processAudioFile(file);
    }
  };

  const handleSeek = (seekTime: number) => {
    setCurrentTime(seekTime);
  };

  const handleStartSeparation = async () => {
    if (!decodedSourceMix) return;

    try {
      setSeparationPhase('downloading');
      setSeparationError(null);
      setSeparatedStems(null);

      if (!inferenceClientRef.current) {
        inferenceClientRef.current = new InferenceClient();
      }
      const client = inferenceClientRef.current;

      const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

      await client.init({
        useMock: isTestEnv,
        onDownloadProgress: (p) => {
          setDownloadProgress(p);
          setSeparationPhase('downloading');
        },
      });

      setSeparationPhase('separating');

      const numChannels = decodedSourceMix.buffer.numberOfChannels;
      const audio: Float32Array[] = [];
      for (let c = 0; c < numChannels; c++) {
        audio.push(decodedSourceMix.buffer.getChannelData(c));
      }

      const result = await client.separate(audio, decodedSourceMix.buffer.sampleRate, {
        onChunkProgress: (p) => {
          setChunkProgress(p);
        },
      });

      setSeparatedStems(result.stems);
      setSeparationPhase('completed');

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
          title: decodedSourceMix.metadata.fileName.replace(/\.[^/.]+$/, ''),
          filename: decodedSourceMix.metadata.fileName,
          duration: decodedSourceMix.metadata.duration,
          sampleRate: decodedSourceMix.metadata.sampleRate,
          size: decodedSourceMix.metadata.fileSize,
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
        setSeparationPhase('idle');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setSeparationError(message);
        setSeparationPhase('error');
      }
    }
  };

  const handleCancelSeparation = () => {
    if (inferenceClientRef.current) {
      inferenceClientRef.current.cancel();
    }
    setSeparationPhase('idle');
    setChunkProgress(null);
    setDownloadProgress(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      <Header
        capability={capability}
        isDetectingWebGPU={isDetectingWebGPU}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 flex flex-col gap-8">
        {capability?.isFallback && (
          <FallbackAdvisory capability={capability} />
        )}

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Separate Music Into Stems
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Extract Vocals, Drums, Bass, and Other instruments locally in your browser using Demucs v4.
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
                <p className="mt-0.5 text-xs text-destructive/90">{decodeError}</p>
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
            accept={SUPPORTED_EXTENSIONS.join(',') + ',' + SUPPORTED_MIME_TYPES.join(',')}
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
              <h3 className="text-base font-semibold text-foreground">Decoding Audio Buffer</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Extracting PCM data and computing peak envelopes for waveform rendering...
              </p>
            </div>
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
                error={separationError}
                onCancel={handleCancelSeparation}
                onRetry={handleStartSeparation}
              />

              {/* Stems Separated Banner (Visible on completion) */}
              {separationPhase === 'completed' && separatedStems && (
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
                            {separatedStems[stem][0]?.length.toLocaleString()} samples
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render Stem Player when separation completes; otherwise render Source Mix Master Waveform */}
              {separationPhase === 'completed' && separatedStems ? (
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
                  songTitle={decodedSourceMix.metadata.fileName}
                />
              ) : (
                <MasterWaveform
                  peaks={waveformPeaks}
                  audioBuffer={decodedSourceMix.buffer}
                  duration={decodedSourceMix.metadata.duration}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              )}
            </div>
          )}
        </section>
      </main>

      <ToastContainer />

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <p>Demuxify Web • 100% Client-Side Audio Source Separation • Powered by Demucs v4 &amp; WebGPU</p>
      </footer>
    </div>
  );
};

export default App;
