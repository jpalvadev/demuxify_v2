import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Layers,
  Trash2,
  Download,
  Gauge,
  Music,
  Plus,
  Minus,
} from "lucide-react";
import { StemName, STEM_NAMES } from "../lib/chunkOverlapAdd";
import {
  StemPlayerEngine,
  StemMixerStates,
  TimeStretchState,
} from "../lib/stemPlayerEngine";
import { StemStrip } from "./StemStrip";
import { MasterWaveform } from "./MasterWaveform";
import { ExportDialog } from "./ExportDialog";
import { WaveformPeaks } from "../lib/waveformPeaks";
import { cn } from "../lib/utils";
import { DISPLAY_FONT_STACK, MONO_FONT_STACK } from "../lib/typography";

// Tab Shell (ADR-0007/0008): live mixer + time-stretch state bridge so the
// Export panel can be mounted at the app level instead of inside the player.
// App hosts the panel inline in the Export Tab and flags exportDialogHosted;
// without that flag the component keeps its legacy internal Export panel
// (per-component seam).
export interface ExportDialogState {
  mixerStates: StemMixerStates;
  masterVolume: number;
  timeStretch: TimeStretchState;
}

// Tab Shell bridge (ADR-0008): transport actions stay available to the app —
// the Mix Tab's single Play/Pause toggle calls play or pause by state, and
// spine scrubbing keeps using seek. Signature unchanged; engine untouched.
export interface TransportControls {
  play: () => void;
  pause: () => void;
  seekToStart: () => void;
  seek: (seekTime: number) => void;
}

export interface StemPlayerProps {
  stems: Record<StemName, Float32Array[] | AudioBuffer>;
  sampleRate?: number;
  duration?: number;
  sourceMixBuffer?: AudioBuffer | null;
  masterPeaks?: WaveformPeaks | null;
  audioContext?: AudioContext;
  sourceMixTitle?: string;
  className?: string;
  initialMixerStates?: StemMixerStates;
  initialMasterVolume?: number;
  initialCurrentTime?: number;
  onMixerChange?: (mixer: {
    stems: StemMixerStates;
    masterVolume: number;
    currentTime: number;
  }) => void;
  onPurgeSession?: () => void;
  // Tab Shell (ADR-0008): the app hosts the Export panel inline in the Export
  // Tab, so the Mix Tab carries no Export Stems action and the player renders
  // no fallback panel of its own.
  exportDialogHosted?: boolean;
  onExportDialogState?: (state: ExportDialogState) => void;
  onTransportControls?: (controls: TransportControls) => void;
  // Tab Shell (ADR-0007): the shell hosts the shared Master Waveform spine in
  // Listen and Mix, so the player's own overview waveform stays hidden.
  masterWaveformHosted?: boolean;
}

function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export const StemPlayer: React.FC<StemPlayerProps> = ({
  stems,
  sampleRate = 44100,
  duration: providedDuration,
  sourceMixBuffer,
  masterPeaks,
  audioContext,
  sourceMixTitle = "source_mix",
  className,
  initialMixerStates,
  initialMasterVolume,
  initialCurrentTime,
  onMixerChange,
  onPurgeSession,
  exportDialogHosted,
  onExportDialogState,
  onTransportControls,
  masterWaveformHosted,
}) => {
  const engineRef = useRef<StemPlayerEngine | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialCurrentTime ?? 0);
  const [duration, setDuration] = useState(providedDuration ?? 0);
  const [mixerStates, setMixerStates] = useState<StemMixerStates>(
    initialMixerStates ?? {
      vocals: { volume: 1.0, muted: false, solo: false },
      drums: { volume: 1.0, muted: false, solo: false },
      bass: { volume: 1.0, muted: false, solo: false },
      other: { volume: 1.0, muted: false, solo: false },
    }
  );
  const [masterVolume, setMasterVolume] = useState(initialMasterVolume ?? 1.0);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [tempo, setTempo] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [formantPreservation, setFormantPreservation] = useState(true);

  // Initialize engine
  useEffect(() => {
    const engine = new StemPlayerEngine(stems, {
      audioContext,
      sampleRate,
      duration: providedDuration,
      initialMixerStates,
      initialMasterVolume,
      initialCurrentTime,
    });
    engineRef.current = engine;

    // Hand transport actions to the shell so the Listen Tab's Transport row
    // drives this same engine (ADR-0007 Tab Shell bridge).
    onTransportControls?.({
      play: () => void handlePlay(),
      pause: handlePause,
      seekToStart: handleReset,
      seek: (seekTime) => void handleSeek(seekTime),
    });

    setDuration(engine.getDuration());
    setMixerStates(engine.getAllStemStates());
    setMasterVolume(engine.getMasterVolume());
    if (initialCurrentTime !== undefined) {
      setCurrentTime(initialCurrentTime);
    }
    setTempo(engine.getTempo());
    setPitch(engine.getPitch());
    setFormantPreservation(engine.isFormantPreservationEnabled());

    const unsubPos = engine.subscribePosition((time) => {
      setCurrentTime(time);
      setIsPlaying(engine.isPlaying());
    });

    const unsubState = engine.subscribeState((states) => {
      setMixerStates(states);
    });

    const unsubTimeStretch = engine.subscribeTimeStretch((ts) => {
      setTempo(ts.tempo);
      setPitch(ts.pitch);
      if (ts.formantPreservation !== undefined) {
        setFormantPreservation(ts.formantPreservation);
      }
    });

    return () => {
      unsubPos();
      unsubState();
      unsubTimeStretch();
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
        typeof (target as any).getAttribute === "function" &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox")
      ) {
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Dedicated transport actions (Tab Shell): Play only starts, Pause only stops.
  const handlePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || engine.isPlaying()) return;
    await engine.play();
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engine.isPlaying()) return;
    engine.pause();
    setIsPlaying(false);
  }, []);

  // Transport toggle (ADR-0008): one button, icon bound to the action coming
  // next; it calls play or pause depending on state through the bridge actions.
  const togglePlayPause = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    if (engine.isPlaying()) {
      handlePause();
    } else {
      await handlePlay();
    }
  }, [handlePlay, handlePause]);

  const handleSeek = useCallback(
    (seekTime: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.seek(seekTime);
      setCurrentTime(seekTime);
      onMixerChange?.({
        stems: engine.getAllStemStates(),
        masterVolume: engine.getMasterVolume(),
        currentTime: seekTime,
      });
    },
    [onMixerChange]
  );

  // Re-export the live state for an app-level Export panel (Tab Shell).
  const emitExportDialogState = () => {
    if (!onExportDialogState) return;
    const engine = engineRef.current;
    if (!engine) return;
    onExportDialogState({
      mixerStates: engine.getAllStemStates(),
      masterVolume: engine.getMasterVolume(),
      timeStretch: {
        tempo: engine.getTempo(),
        pitch: engine.getPitch(),
        formantPreservation: engine.isFormantPreservationEnabled(),
      },
    });
  };

  const handleReset = useCallback(() => {
    handleSeek(0);
  }, [handleSeek]);

  const handleVolumeChange = useCallback(
    (stem: StemName, volume: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setStemVolume(stem, volume);
      onMixerChange?.({
        stems: engine.getAllStemStates(),
        masterVolume: engine.getMasterVolume(),
        currentTime: engine.getCurrentTime(),
      });
      emitExportDialogState();
    },
    [onMixerChange]
  );

  const handleToggleMute = useCallback(
    (stem: StemName) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.toggleStemMute(stem);
      onMixerChange?.({
        stems: engine.getAllStemStates(),
        masterVolume: engine.getMasterVolume(),
        currentTime: engine.getCurrentTime(),
      });
      emitExportDialogState();
    },
    [onMixerChange]
  );

  const handleToggleSolo = useCallback(
    (stem: StemName) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.toggleStemSolo(stem);
      onMixerChange?.({
        stems: engine.getAllStemStates(),
        masterVolume: engine.getMasterVolume(),
        currentTime: engine.getCurrentTime(),
      });
      emitExportDialogState();
    },
    [onMixerChange]
  );

  const handleMasterVolumeChange = useCallback(
    (volume: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setMasterVolume(volume);
      setMasterVolume(volume);
      onMixerChange?.({
        stems: engine.getAllStemStates(),
        masterVolume: volume,
        currentTime: engine.getCurrentTime(),
      });
      emitExportDialogState();
    },
    [onMixerChange]
  );

  const handleTempoChange = useCallback((newTempo: number) => {
    // 0.05x quantization so the slider, +/- buttons and presets all land on
    // exact grid values (avoids 1.3500000000000001-style float drift).
    const quantized = Math.max(
      0.5,
      Math.min(2.0, Math.round(newTempo * 20) / 20)
    );
    engineRef.current?.setTempo(quantized);
    setTempo(quantized);
    emitExportDialogState();
  }, []);

  const handleIncrementTempo = useCallback(() => {
    // Engine-first: the fork defers state-updater callbacks, so side effects
    // must run synchronously here (see handleTempoChange).
    const engine = engineRef.current;
    const current = engine ? engine.getTempo() : tempo;
    const next = Math.min(2.0, Math.round((current + 0.05) * 20) / 20);
    engine?.setTempo(next);
    setTempo(next);
    emitExportDialogState();
  }, []);

  const handleDecrementTempo = useCallback(() => {
    const engine = engineRef.current;
    const current = engine ? engine.getTempo() : tempo;
    const next = Math.max(0.5, Math.round((current - 0.05) * 20) / 20);
    engine?.setTempo(next);
    setTempo(next);
    emitExportDialogState();
  }, []);

  const handlePitchChange = useCallback((newPitch: number) => {
    const quantized = Math.max(-12, Math.min(12, Math.round(newPitch)));
    engineRef.current?.setPitch(quantized);
    setPitch(quantized);
    emitExportDialogState();
  }, []);

  const handleIncrementPitch = useCallback(() => {
    const engine = engineRef.current;
    const current = engine ? engine.getPitch() : pitch;
    const next = Math.min(12, current + 1);
    engine?.setPitch(next);
    setPitch(next);
    emitExportDialogState();
  }, []);

  const handleDecrementPitch = useCallback(() => {
    const engine = engineRef.current;
    const current = engine ? engine.getPitch() : pitch;
    const next = Math.max(-12, current - 1);
    engine?.setPitch(next);
    setPitch(next);
    emitExportDialogState();
  }, []);

  const handleToggleFormant = useCallback(() => {
    const engine = engineRef.current;
    const next = !(engine
      ? engine.isFormantPreservationEnabled()
      : formantPreservation);
    engine?.setFormantPreservation(next);
    setFormantPreservation(next);
    emitExportDialogState();
  }, []);

  const handleResetTimeStretch = useCallback(() => {
    engineRef.current?.resetTimeStretch();
    setTempo(1.0);
    setPitch(0);
    emitExportDialogState();
  }, []);

  // Determine silencing for visual feedback
  const hasAnySolo = STEM_NAMES.some((s) => mixerStates[s]?.solo);

  return (
    <section
      role="region"
      aria-label="Stem Player"
      className={cn(
        "w-full rounded-none border border-border bg-card/70 p-4 sm:p-6 shadow-md backdrop-blur-md space-y-6",
        className
      )}
    >
      {/* Player Header with Title and Global Transport */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-none bg-primary/10 border border-primary/20 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3
              className="font-display text-lg font-bold tracking-tight text-foreground"
              style={{ fontFamily: DISPLAY_FONT_STACK }}
            >
              Multi-Track Stem Player
            </h3>
            <p className="text-xs text-muted-foreground">
              Synchronized 4-Stem playback with solo, mute, and level controls
            </p>
          </div>
        </div>

        {/* Global Transport Bar */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-4">
          {/* Time Display: strong mono readout (Bold port of the .tread row) */}
          <div
            data-testid="stem-player-time"
            className="flex items-center gap-1 font-mono text-lg font-extrabold tracking-tight bg-secondary/60 px-3 py-1.5 rounded-none border border-border/60"
            style={{ fontFamily: MONO_FONT_STACK }}
          >
            <span className="text-primary font-bold">
              {formatTime(currentTime)}
            </span>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>

          {/* Transport: single Play/Pause toggle (ADR-0008). Icon shows the
              action coming next: ▶ while paused, ⏸ while playing; one stable
              accessible name plus aria-pressed for assistive tech. The Seek-to-
              start button is gone; the Master Waveform spine is the timeline. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Play/Pause"
              aria-pressed={isPlaying}
              title="Play/Pause (Space)"
              onClick={togglePlayPause}
              className={cn(
                "flex h-11 px-5 items-center justify-center gap-2 rounded-none border transition-all font-semibold shadow-sm active:scale-95",
                isPlaying
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-secondary/60 text-foreground border-border hover:bg-secondary"
              )}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              <span className="hidden sm:inline font-mono uppercase text-[10px] font-bold">
                Play/Pause
              </span>
            </button>

            {onPurgeSession && (
              <button
                type="button"
                aria-label="Purge Session"
                title="Purge session and start fresh"
                onClick={onPurgeSession}
                className="flex h-10 px-3 items-center justify-center gap-1.5 rounded-none border border-border bg-secondary/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all text-xs font-semibold"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Reset Session</span>
              </button>
            )}

            {/* Export Stems Action — standalone form only. The hosted app
                form (exportDialogHosted) keeps the Export panel inline in the
                Export Tab, so the Mix Tab never carries this action. */}
            {!exportDialogHosted && (
              <button
                type="button"
                aria-label="Export Stems"
                title="Export isolated stems (WAV/MP3/ZIP)"
                onClick={() => setIsExportDialogOpen(true)}
                className="flex h-10 px-3.5 items-center justify-center gap-2 rounded-none border border-border bg-secondary/60 text-foreground font-medium shadow-xs hover:bg-secondary hover:border-primary/40 active:scale-95 transition-all text-xs sm:text-sm"
              >
                <Download className="h-4 w-4 text-primary" />
                <span>Export Stems</span>
              </button>
            )}
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
              onChange={(e) =>
                handleMasterVolumeChange(parseFloat(e.target.value))
              }
              aria-label="Master Volume"
              className="w-24 accent-primary cursor-pointer h-1.5 bg-secondary rounded-none appearance-none"
            />
            <span className="text-xs font-mono text-muted-foreground w-7 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Master Overview Waveform: omitted when the Tab Shell owns the spine */}
      {!masterWaveformHosted && (
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
      )}

      {/* Time-Stretch & Pitch Shift Controls */}
      <div className="rounded-none border border-border/60 bg-secondary/30 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-none bg-primary/10 text-primary border border-primary/20">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Time-Stretch & Pitch
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Independent real-time tempo (0.5x–2.0x) and pitch transposition
                (-12 to +12 st)
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Reset Time-Stretch"
            title="Reset pitch to 0 and tempo to 1.0x"
            onClick={handleResetTimeStretch}
            disabled={Math.abs(tempo - 1.0) < 0.001 && pitch === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-border/80 bg-secondary/80 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Pitch & Tempo</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Tempo Section */}
          <div className="rounded-none border border-border/50 bg-card/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-primary" />
                Tempo / Speed
              </span>
              <span
                data-testid="current-tempo-label"
                className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-none border border-primary/20"
              >
                {tempo.toFixed(2)}x
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrement Tempo"
                title="Slow down 0.05x"
                onClick={handleDecrementTempo}
                disabled={tempo <= 0.5}
                className="flex h-8 w-8 items-center justify-center rounded-none border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              <div className="flex-1 flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">
                  0.50x
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={tempo}
                  onChange={(e) =>
                    handleTempoChange(parseFloat(e.target.value))
                  }
                  aria-label="Playback Tempo"
                  className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-none appearance-none"
                />
                <span className="text-[11px] font-mono text-muted-foreground">
                  2.00x
                </span>
              </div>

              <button
                type="button"
                aria-label="Increment Tempo"
                title="Speed up 0.05x"
                onClick={handleIncrementTempo}
                disabled={tempo >= 2.0}
                className="flex h-8 w-8 items-center justify-center rounded-none border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 sm:gap-1.5 pt-0.5">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((preset) => {
                const label = `${preset.toFixed(2)}x`;
                const isSelected = Math.abs(tempo - preset) < 0.01;
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Tempo preset ${label}`}
                    aria-pressed={isSelected}
                    onClick={() => handleTempoChange(preset)}
                    className={cn(
                      "flex-1 py-1 rounded-none text-[10px] sm:text-[11px] font-semibold border transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground border-border/60"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pitch Section */}
          <div className="rounded-none border border-border/50 bg-card/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5 text-accent" />
                Pitch Transposition
              </span>
              <span
                data-testid="current-pitch-label"
                className="font-mono text-xs font-bold text-foreground bg-secondary px-2 py-0.5 rounded-none border border-border"
              >
                {pitch === 0
                  ? "0 st"
                  : `${pitch > 0 ? "+" : ""}${
                      Number.isInteger(pitch)
                        ? pitch
                        : pitch.toFixed(2).replace(/\.?0+$/, "")
                    } st`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrement Pitch"
                title="Shift pitch down 1 semitone"
                onClick={handleDecrementPitch}
                disabled={pitch <= -12}
                className="flex h-8 w-8 items-center justify-center rounded-none border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              <div className="flex-1 flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">
                  -12
                </span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={pitch}
                  onChange={(e) =>
                    handlePitchChange(parseFloat(e.target.value))
                  }
                  aria-label="Pitch Shift"
                  className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-none appearance-none"
                />
                <span className="text-[11px] font-mono text-muted-foreground">
                  +12
                </span>
              </div>

              <button
                type="button"
                aria-label="Increment Pitch"
                title="Shift pitch up 1 semitone"
                onClick={handleIncrementPitch}
                disabled={pitch >= 12}
                className="flex h-8 w-8 items-center justify-center rounded-none border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>Octave Down (-12)</span>
              <span>Original (0)</span>
              <span>Octave Up (+12)</span>
            </div>

            {/* Vocal Formant Preservation Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>Vocal Formant Preservation</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                    Vocals Stem
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Keeps natural vocal timbre across semitone changes
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Vocal Formant Preservation"
                aria-checked={formantPreservation}
                onClick={handleToggleFormant}
                className={cn(
                  "relative inline-flex h-5 w-9 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-none border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                  formantPreservation ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-none bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    formantPreservation
                      ? "translate-x-4 sm:translate-x-5"
                      : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stem Strips List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          <span>Stems</span>
          <span className="hidden sm:inline font-normal lowercase text-[11px] text-muted-foreground/80">
            Solo (S) isolations mute unselected stems • Mute (M) silences stem
          </span>
        </div>

        {STEM_NAMES.map((stem) => {
          const state = mixerStates[stem];
          const isSilenced = hasAnySolo
            ? !state.solo || state.muted
            : state.muted;
          const stemBuffer = engineRef.current?.getStemBuffer(stem);

          return (
            <StemStrip
              key={stem}
              stem={stem}
              settings={state}
              audioBuffer={stemBuffer}
              duration={duration}
              currentTime={currentTime}
              isSilenced={isSilenced}
              onVolumeChange={(vol) => handleVolumeChange(stem, vol)}
              onToggleMute={() => handleToggleMute(stem)}
              onToggleSolo={() => handleToggleSolo(stem)}
              onSeek={handleSeek}
            />
          );
        })}
      </div>

      {/* Export panel fallback — standalone form only; the hosted app form
          (exportDialogHosted) keeps the panel inline in the Export Tab. */}
      {!exportDialogHosted && (
        <ExportDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          stems={stems}
          sampleRate={sampleRate}
          sourceMixTitle={sourceMixTitle}
          initialMixerStates={mixerStates}
          initialMasterVolume={masterVolume}
          activeTimeStretch={{ tempo, pitch, formantPreservation }}
        />
      )}
    </section>
  );
};
