import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, Layers } from 'lucide-react';
import { StemName, STEM_NAMES } from '../lib/chunkOverlapAdd';
import { StemPlayerEngine, StemMixerStates } from '../lib/stemPlayerEngine';
import { StemTrack } from './StemTrack';
import { MasterWaveform } from './MasterWaveform';
import { WaveformPeaks } from '../lib/waveformPeaks';
import { cn } from '../lib/utils';

export interface StemPlayerProps {
  stems: Record<StemName, Float32Array[] | AudioBuffer>;
  sampleRate?: number;
  duration?: number;
  sourceMixBuffer?: AudioBuffer | null;
  masterPeaks?: WaveformPeaks | null;
  audioContext?: AudioContext;
  className?: string;
}

function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const StemPlayer: React.FC<StemPlayerProps> = ({
  stems,
  sampleRate = 44100,
  duration: providedDuration,
  sourceMixBuffer,
  masterPeaks,
  audioContext,
  className,
}) => {
  const engineRef = useRef<StemPlayerEngine | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(providedDuration ?? 0);
  const [mixerStates, setMixerStates] = useState<StemMixerStates>({
    vocals: { volume: 1.0, muted: false, solo: false },
    drums: { volume: 1.0, muted: false, solo: false },
    bass: { volume: 1.0, muted: false, solo: false },
    other: { volume: 1.0, muted: false, solo: false },
  });
  const [masterVolume, setMasterVolume] = useState(1.0);

  // Initialize engine
  useEffect(() => {
    const engine = new StemPlayerEngine(stems, {
      audioContext,
      sampleRate,
      duration: providedDuration,
    });
    engineRef.current = engine;

    setDuration(engine.getDuration());
    setMixerStates(engine.getAllStemStates());
    setMasterVolume(engine.getMasterVolume());

    const unsubPos = engine.subscribePosition((time) => {
      setCurrentTime(time);
      setIsPlaying(engine.isPlaying());
    });

    const unsubState = engine.subscribeState((states) => {
      setMixerStates(states);
    });

    return () => {
      unsubPos();
      unsubState();
      engine.dispose();
      engineRef.current = null;
    };
  }, [stems, sampleRate, providedDuration, audioContext]);

  // Spacebar Hotkey listener for Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is focused inside an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        typeof (target as any).getAttribute === 'function' &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox')
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const togglePlayPause = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    if (engine.isPlaying()) {
      engine.pause();
      setIsPlaying(false);
    } else {
      await engine.play();
      setIsPlaying(true);
    }
  }, []);

  const handleSeek = useCallback((seekTime: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.seek(seekTime);
    setCurrentTime(seekTime);
  }, []);

  const handleReset = useCallback(() => {
    handleSeek(0);
  }, [handleSeek]);

  const handleVolumeChange = useCallback((stem: StemName, volume: number) => {
    engineRef.current?.setStemVolume(stem, volume);
  }, []);

  const handleToggleMute = useCallback((stem: StemName) => {
    engineRef.current?.toggleStemMute(stem);
  }, []);

  const handleToggleSolo = useCallback((stem: StemName) => {
    engineRef.current?.toggleStemSolo(stem);
  }, []);

  const handleMasterVolumeChange = useCallback((volume: number) => {
    engineRef.current?.setMasterVolume(volume);
    setMasterVolume(volume);
  }, []);

  // Determine silencing for visual feedback
  const hasAnySolo = STEM_NAMES.some((s) => mixerStates[s]?.solo);

  return (
    <section
      role="region"
      aria-label="Stem Player"
      className={cn(
        'w-full rounded-2xl border border-border bg-card/70 p-4 sm:p-6 shadow-md backdrop-blur-md space-y-6',
        className
      )}
    >
      {/* Player Header with Title and Global Transport */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              Multi-Track Stem Player
            </h3>
            <p className="text-xs text-muted-foreground">
              Synchronized 4-Stem playback with solo, mute, and level controls
            </p>
          </div>
        </div>

        {/* Global Transport Bar */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-4">
          {/* Time Display */}
          <div className="flex items-center gap-1 font-mono text-sm bg-secondary/60 px-3 py-1.5 rounded-xl border border-border/60">
            <span className="text-primary font-bold">{formatTime(currentTime)}</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-muted-foreground">{formatTime(duration)}</span>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Reset to Beginning"
              title="Reset to beginning"
              onClick={handleReset}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              onClick={togglePlayPause}
              className="flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                  <span>Play</span>
                </>
              )}
            </button>
          </div>

          {/* Master Volume Slider */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-border/60">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
              aria-label="Master Volume"
              className="w-24 accent-primary cursor-pointer h-1.5 bg-secondary rounded-lg appearance-none"
            />
            <span className="text-xs font-mono text-muted-foreground w-7 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Master Overview Waveform */}
      <div className="space-y-1">
        <MasterWaveform
          peaks={masterPeaks}
          audioBuffer={sourceMixBuffer}
          duration={duration}
          currentTime={currentTime}
          onSeek={handleSeek}
          height={88}
        />
      </div>

      {/* 4 Stem Tracks List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          <span>Stems</span>
          <span className="hidden sm:inline font-normal lowercase text-[11px] text-muted-foreground/80">
            Solo (S) isolations mute unselected stems • Mute (M) silences stem
          </span>
        </div>

        {STEM_NAMES.map((stem) => {
          const state = mixerStates[stem];
          const isSilenced = hasAnySolo ? (!state.solo || state.muted) : state.muted;
          const stemBuffer = engineRef.current?.getStemBuffer(stem);

          return (
            <StemTrack
              key={stem}
              stem={stem}
              audioBuffer={stemBuffer}
              duration={duration}
              currentTime={currentTime}
              volume={state.volume}
              muted={state.muted}
              solo={state.solo}
              isSilenced={isSilenced}
              onVolumeChange={(vol) => handleVolumeChange(stem, vol)}
              onToggleMute={() => handleToggleMute(stem)}
              onToggleSolo={() => handleToggleSolo(stem)}
              onSeek={handleSeek}
            />
          );
        })}
      </div>
    </section>
  );
};
