import React, { useEffect, useState, useRef, ChangeEvent } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { SourceMixDropzone } from './components/SourceMixDropzone';
import { FallbackAdvisory } from './components/FallbackAdvisory';
import { SourceMixCard } from './components/SourceMixCard';
import { MasterWaveform } from './components/MasterWaveform';
import { detectWebGPUCapability, WebGPUCapability } from './lib/webgpu';
import { decodeAudio, DecodedSourceMix } from './lib/audioDecoder';
import { computeWaveformPeaks, WaveformPeaks } from './lib/waveformPeaks';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

    return () => {
      isMounted = false;
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
    processAudioFile(file);
  };

  const handleClearSourceMix = () => {
    setSelectedFile(null);
    setDecodedSourceMix(null);
    setWaveformPeaks(null);
    setCurrentTime(0);
    setDecodeError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  const handleStartSeparation = () => {
    // Ticket 03/04 will connect the Inference Engine to begin chunked separation
    console.log('Beginning separation on Source Mix:', decodedSourceMix?.metadata.fileName);
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

              <MasterWaveform
                peaks={waveformPeaks}
                audioBuffer={decodedSourceMix.buffer}
                duration={decodedSourceMix.metadata.duration}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <p>Demuxify Web • 100% Client-Side Audio Source Separation • Powered by Demucs v4 &amp; WebGPU</p>
      </footer>
    </div>
  );
};

export default App;
