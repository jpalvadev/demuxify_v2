import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Layers,
  Download,
  Gauge,
  Music,
  Mic,
  Plus,
  Minus,
} from "lucide-react";
import { StemName, STEM_NAMES } from "../lib/chunkOverlapAdd";
import {
  StemPlayerEngine,
  StemMixerStates,
  TimeStretchState,
  ClickTrackMixerState,
  CalibratedClickGrid,
} from "../lib/stemPlayerEngine";
import { StemStrip } from "./StemStrip";
import { MasterWaveform } from "./MasterWaveform";
import { ExportDialog } from "./ExportDialog";
import { WaveformPeaks } from "../lib/waveformPeaks";
import { cn } from "../lib/utils";
import { DISPLAY_FONT_STACK, MONO_FONT_STACK } from "../lib/typography";
// Readout only: the Tempo Detector's ranked candidate shape (ticket 06). Type-
// only import, so the player never pulls the beat-detection worker at runtime.
import type { TempoCandidate } from "../workers/beatDetection.worker";

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
  // ADR-0008 (ticket 04): no onPurgeSession — the Mix Tab's playback surface
  // carries no destructive Session-wipe affordance; the full purge lives on
  // the Separate Tab's Session Recovery Discard.
  // Tab Shell (ADR-0008): the app hosts the Export panel inline in the Export
  // Tab, so the Mix Tab carries no Export Stems action and the player renders
  // no fallback panel of its own.
  exportDialogHosted?: boolean;
  onExportDialogState?: (state: ExportDialogState) => void;
  onTransportControls?: (controls: TransportControls) => void;
  // Mix Tab cohesion (ADR-0013): one outbound Playhead channel — the app wires
  // the shared Master Waveform spine to it, fed by the engine's existing
  // position subscription. The mixer-and-Session bridge keeps its own meaning
  // and is never fired per frame.
  onPlayheadChange?: (timeSec: number) => void;
  // Tab Shell (ADR-0007): the shell hosts the shared Master Waveform spine in
  // Listen and Mix, so the player's own overview waveform stays hidden.
  masterWaveformHosted?: boolean;
  // Click Track lane (ADR-0010, ticket 04): the Beat Grid (beat positions in
  // seconds) from the Tempo Detector plus the rail's initial settings. The lane
  // is domain-separate from Stem — it never joins the StemName identities.
  beatGrid?: Float64Array | null;
  initialClickTrack?: ClickTrackMixerState;
  // Readout only: the BPM the Beat Grid was locked at (chosen candidate).
  clickTrackBpm?: number | null;
  onClickTrackState?: (state: ClickTrackMixerState) => void;
  // Ticket 06: the ranked Tempo Detector readings behind the Beat Grid, so the
  // rail can show the top candidate plus alternatives with confidence and offer
  // the picker that re-locks. Domain-separate: candidates are not Stems.
  tempoCandidates?: TempoCandidate[] | null;
  // The rail's picker: the app re-runs the Tempo Detector with the chosen
  // tempo as hint, then swaps the Beat Grid when the re-lock arrives.
  onChooseTempoCandidate?: (bpm: number) => void;
  // Hand Calibration (ticket 08): set when the user tapped beats and the
  // Beat Grid was re-anchored by hand instead of the Detector. The rail says
  // "calibrated by hand" — it never calls a by-hand decision an auto reading.
  clickCalibration?: CalibratedClickGrid | null;
}

function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Click Track rail (ADR-0010, ticket 04): the lane's neutral default — off, so
// opening the Mix tab never surprises the user with a metronome over the Stems.
const CLICK_TRACK_DEFAULT: ClickTrackMixerState = {
  enabled: false,
  volume: 1.0,
};

// Tempo Detector readout helpers (ticket 06). The engine only ever ranks: a
// reading is confident only when a single candidate owns it, so an octave-
// related alternative (a pulse and its doubling are indistinguishable) keeps
// the rail honest — it says so and offers the picker instead of a bare BPM.
const isConfidentReading = (candidates: TempoCandidate[]): boolean =>
  candidates.length === 1 && candidates[0].confidence >= 0.99;

const formatConfidence = (confidence: number): string =>
  `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;

// The Beat Grid is locked to a candidate when that candidate is the chosen
// tempo; beatTrack's phase-aligned bpm can sit a hair off its input, so the
// comparison is tolerant rather than exact.
const isLockedCandidate = (bpm: number, lockedBpm: number | null): boolean =>
  lockedBpm !== null && Math.abs(bpm - lockedBpm) < 0.05;

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
  exportDialogHosted,
  onExportDialogState,
  onTransportControls,
  onPlayheadChange,
  masterWaveformHosted,
  beatGrid,
  initialClickTrack,
  clickTrackBpm,
  onClickTrackState,
  tempoCandidates,
  onChooseTempoCandidate,
  clickCalibration,
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
  // Click Track lane state lives here (not in the mixer states): domain-separate.
  const [clickTrack, setClickTrack] = useState<ClickTrackMixerState>(
    initialClickTrack ?? CLICK_TRACK_DEFAULT
  );

  // Initialize engine
  useEffect(() => {
    const engine = new StemPlayerEngine(stems, {
      audioContext,
      sampleRate,
      duration: providedDuration,
      initialMixerStates,
      initialMasterVolume,
      initialCurrentTime,
      initialClickTrack,
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
    setClickTrack(engine.getClickTrackState());
    onClickTrackState?.(engine.getClickTrackState());

    const unsubPos = engine.subscribePosition((time) => {
      setCurrentTime(time);
      setIsPlaying(engine.isPlaying());
      // Mix Tab cohesion (ADR-0013): the same subscription feeds the app's one
      // Playhead channel — the spine mirrors the live position, no second
      // subscriber and no per-frame mixer bridge.
      onPlayheadChange?.(time);
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

  // Beat Grid (ADR-0010): swapping the grid replaces the clicks' positions; a
  // lane with no grid has no clicks.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setBeatGrid(beatGrid ?? null);
    setClickTrack(engine.getClickTrackState());
    onClickTrackState?.(engine.getClickTrackState());
  }, [beatGrid]);

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

  // --- Click Track rail handlers (ADR-0010, ticket 04) ---------------------
  // Domain-separate from the Stem mixer contract: the rail reports its own
  // state to the app (Session persistence), and nothing here touches mixerStates.
  const handleToggleClickTrack = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.toggleClickTrack();
    setClickTrack(engine.getClickTrackState());
    onClickTrackState?.(engine.getClickTrackState());
  }, [onClickTrackState]);

  // Mix Rail Tidy-Up (ticket 03): no handleToggleClickTrackMute — the rail
  // has no M button to press (ADR-0010 Amendment).

  const handleSetClickTrackVolume = useCallback(
    (volume: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setClickTrackVolume(volume);
      setClickTrack(engine.getClickTrackState());
      onClickTrackState?.(engine.getClickTrackState());
    },
    [onClickTrackState]
  );

  // Determine silencing for visual feedback
  const hasAnySolo = STEM_NAMES.some((s) => mixerStates[s]?.solo);

  return (
    <>
      {/* Stitch skin 08a (user's Mix-card surgery): the standalone Tempo Detector
          candidate Rail is DELETED — the ranked readings now live inside the
          Click Track card below (its picker island, `{bpm} BPM` +
          `{pct}% match` chips), so the fragment root opens straight on the
          Stem Player section and the master band loses its welded foot rail.
          The decision machinery is untouched: the picker still asks the app
          for a re-lock hint through onChooseTempoCandidate, and ADR-0013's
          amendment keeps the honest ranking copy as the picker group's
          accessible name. */}
      <section
        role="region"
        aria-label="Stem Player"
        className={cn(
          "w-full rounded-lg border border-st-hairline bg-st-panel p-3 space-y-2.5",
          className
        )}
      >
        {/* Section masthead: the "Multi-Track Stem Player" title, its Layers mark
          and tagline at the head of the Mix panel. The live master transport
          that used to ride under it is erased from the hosted stage (Stitch
          skin 07j): the mockup has no such strip inside the section. */}
        {/* Section header (Stitch skin, ticket 06c of the mix pass): the mockup
            masthead — bare coral Layers mark, uppercase wordmark (the h3 stays
            the Mix banner the typography seam pins in Inter, so the mockup's
            mono masthead font is ported as Inter-bold), inline subtitle, and
            the solo/mute hint at the right — welded under a hairline. */}
        <div className="flex items-center justify-between font-mono text-[11px] pb-1 border-b border-st-hairline/60">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-st-coral shrink-0" />
            <h3
              className="inline-block font-display font-bold uppercase tracking-wider text-st-ink"
              style={{ fontFamily: DISPLAY_FONT_STACK }}
            >
              Multi-Track Stem Player
            </h3>
            <span className="text-[10px] text-st-ink-dim">
              Synchronized 4-Stem real-time playback
            </span>
          </div>
          <span
            data-testid="stem-solo-mute-hint"
            aria-hidden="true"
            className="hidden flex items-center gap-1 text-[10px] text-st-ink-dim sm:inline font-mono"
            style={{ fontFamily: MONO_FONT_STACK }}
          >
            Solo (<span className="text-st-ink">s</span>) isolates · Mute (
            <span className="text-st-ink">m</span>) silences track
          </span>
        </div>

        {/* Stem Strips (ADR-0013, ticket 08): the thing you actually mix, right
          after the master waveform spine and before the Click Track card — the
          stage reads in the order the work is done. Stitch skin 08a folded the
          ranked readings into the card, so nothing of the Detector sits loose
          between the spine and the strips anymore. */}
        <div className="space-y-2.5">
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

        {/* Time-Stretch & Pitch Shift controls (Stitch skin 07k): the mockup's
          DSP rack has NO container behind it — the rack is a bare grid on the
          workspace surface whose cards are the parts. So the outer wrapper is
          transparent (no border, no fill, no padding) and each card carries
          its own mockup rule. */}
        {/* DSP rack (Stitch skin 07n, card surgery 08b): the mockup has NO rack
          heading — the trio of cards sits straight on the workspace surface.
          The old title row (badge, h4, description, reset chip) is gone and the
          live Reset Time-Stretch chip is homed at the foot of the Tempo card.
          The third card is no longer a dead placeholder: it is the live Click
          Track / Metronome card (the user's 08b instruction moved the real
          click affordance INTO the card that says CLICK TRACK / METRONOME). */}
        <div
          data-testid="dsp-rack-root"
          className="w-full flex flex-col gap-3 sm:gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Tempo Section */}
            <div className="rounded-lg border border-st-hairline bg-st-panel p-3 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-st-hairline/60">
                <span className="font-mono text-[11px] font-bold text-st-ink uppercase flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  Time-Stretch & Speed
                </span>
                <span
                  data-testid="current-tempo-label"
                  className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded"
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
                  className="flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                    className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded appearance-none"
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
                  className="flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                        "flex-1 py-1 rounded font-mono text-[10px] sm:text-[11px] font-semibold border transition-all",
                        isSelected
                          ? "bg-primary text-white font-bold shadow-chip-glow"
                          : "bg-st-surface text-zinc-400 hover:text-white hover:border-zinc-500 border-st-hairline"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Reset chip (Stitch skin 07n): the rack heading row is gone
                with the mockup, so the live Reset Time-Stretch chip lives at
                the foot of the Tempo card — same button, same contract, a
                quieter zinc mockup chip. */}
              <button
                type="button"
                aria-label="Reset Time-Stretch"
                title="Reset pitch to 0 and tempo to 1.0x"
                onClick={handleResetTimeStretch}
                disabled={Math.abs(tempo - 1.0) < 0.001 && pitch === 0}
                className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded border border-st-hairline bg-st-surface text-[10px] font-mono text-st-ash hover:text-st-ink transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-3 w-3 text-st-ink" />
                <span>Reset Pitch & Tempo</span>
              </button>
            </div>

            {/* Pitch Section */}
            <div className="rounded-lg border border-st-hairline bg-st-panel p-3 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-st-hairline/60">
                <span className="font-mono text-[11px] font-bold text-st-ink uppercase flex items-center gap-2">
                  <Music className="h-3.5 w-3.5 text-accent" />
                  Pitch Transposition
                </span>
                <span
                  data-testid="current-pitch-label"
                  className="font-mono text-[11px] font-bold text-zinc-300 bg-st-surface px-1.5 py-0.5 rounded border border-st-hairline"
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
                  className="flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                    className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded appearance-none"
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
                  className="flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                    "h-8 w-8 rounded border text-xs font-bold transition-all flex items-center justify-center",
                    formantPreservation
                      ? "border-primary/70 bg-primary text-primary-foreground shadow-xs font-black"
                      : "border-border/70 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Mic className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Click Track / Metronome card (Stitch skin 08b, the user's
              card surgery): the DSP rack's third slot keeps its mockup
              header — icon, name, bottom border — and everything that was
              inside it is deleted outright: the phantom BPM meta chip, the
              volume row that moved nothing, the coral Reset footer. The
              app's real Click Track affordance (ADR-0010, ticket 06
              machinery) moved in here from the mixer lane after the four
              Stem Strips: the ranked-readings island above the ♪ switch and
              the volume fader. The lane is domain-separate — never a Stem —
              and, being live, carries no aria-hidden and no placeholder mark. */}
            <div
              role="group"
              aria-label="Click Track"
              data-testid="click-track-rail"
              className="rounded-lg border border-st-hairline bg-st-panel p-3 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-st-hairline/60">
                <span className="font-mono text-[11px] font-bold text-st-ink uppercase flex items-center gap-2">
                  <Gauge
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  Click Track / Metronome
                </span>
              </div>

              {/* The picker island (ticket 06 machinery): the Tempo Detector's
                  ranked readings as one compact chip family. A pulse and its
                  metric doubling are genuinely indistinguishable, so the
                  picker GROUP's accessible name carries the honest ranking
                  copy — calibrated by hand, a solid reading, or the ranked
                  count — and no chip claims one BPM as certain: the locked
                  chip shows its own confidence. Picking an alternative asks
                  the app to re-run the Tempo Detector with that tempo as
                  hint, re-locking the Beat Grid; the chip the grid is locked
                  to stays informational. */}
              {tempoCandidates && tempoCandidates.length > 0 && (
                <div
                  role="group"
                  aria-label={
                    clickCalibration
                      ? `calibrated by hand · your ${clickCalibration.tapsSec.length} taps anchor the grid`
                      : isConfidentReading(tempoCandidates)
                        ? `solid reading · confidence ${formatConfidence(tempoCandidates[0].confidence)}`
                        : `${tempoCandidates.length} readings ranked · pick the feel you hear`
                  }
                  data-testid="click-track-candidate-picker"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-fit justify-items-center font-mono text-[10px] rounded border border-st-hairline bg-st-panel p-2"
                >
                  {tempoCandidates.map((candidate) => {
                    const locked = isLockedCandidate(
                      candidate.bpm,
                      clickTrackBpm ?? null
                    );
                    const bpmLabel = `${candidate.bpm.toFixed(1)} BPM`;
                    return (
                      <button
                        key={bpmLabel}
                        type="button"
                        aria-label={
                          locked
                            ? `Beat Grid locked to ${bpmLabel}`
                            : `Re-lock Beat Grid to ${bpmLabel}`
                        }
                        aria-pressed={locked}
                        title={bpmLabel}
                        disabled={locked || !onChooseTempoCandidate}
                        onClick={() => {
                          if (!locked) {
                            onChooseTempoCandidate?.(candidate.bpm);
                          }
                        }}
                        className={cn(
                          // Mock chip rule (verbatim per the user's card): one
                          // compact shape for every reading, pair spread
                          // justify-between; coral stays on the locked chip only.
                          // Compact chip rule: the shape hugs its own content, the
                          // pair keeps a fixed gutter, and justify-items-center in
                          // the picker grid stops a dead cell from stretching a
                          // chip to full width (the mock's own 1fr cells do).
                          "p-1.5 rounded border flex items-center justify-between gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                          locked
                            ? "border-st-coral/50 bg-st-coral/15 text-white cursor-default"
                            : "border-st-hairline bg-st-surface text-zinc-400 hover:border-zinc-500 cursor-pointer"
                        )}
                      >
                        <span
                          className={cn(
                            "font-medium shrink-0",
                            locked ? "font-bold text-st-coral" : "text-zinc-300"
                          )}
                        >
                          {bpmLabel}
                        </span>{" "}
                        <span
                          className={cn(
                            "text-[9px] shrink-0",
                            locked ? "text-white" : "text-zinc-500"
                          )}
                        >
                          {formatConfidence(candidate.confidence)} match
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Mixer controls: the ♪ enable switch (off by default) and the
                  volume fader — like a lane, with no rate control of its own
                  (Time-Stretch owns the rate). */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-label="Click Track"
                    aria-checked={clickTrack.enabled}
                    title="Click Track on/off (Beat Grid metronome)"
                    disabled={!beatGrid || beatGrid?.length === 0}
                    onClick={handleToggleClickTrack}
                    className={cn(
                      "h-8 w-8 rounded border text-xs font-bold transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed",
                      clickTrack.enabled
                        ? "border-primary/70 bg-primary text-primary-foreground shadow-xs font-black"
                        : "border-border/70 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    ♪
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  {clickTrack.volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={clickTrack.volume}
                    onChange={(e) =>
                      handleSetClickTrackVolume(parseFloat(e.target.value))
                    }
                    aria-label="Click Track Volume"
                    className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded appearance-none"
                  />
                  <span className="text-[11px] font-mono text-muted-foreground w-7 text-right">
                    {Math.round(clickTrack.volume * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The hosted Mix Tab renders NO live transport strip (Stitch skin
          07j): the mockup's section foot is the DSP rack and the user erased
          the timecode / Play-Pause / master-fader cluster from the screen.
          Keyboard Space still toggles the shared engine (the window keydown
          handler above survives the erasure) and the Master Waveform spine
          stays the scrub surface. The standalone component harness form
          (exportDialogHosted false) keeps the full cluster so its behavior
          contract stays pinned. */}
        {!exportDialogHosted && (
          <div
            data-testid="transport-row"
            className="w-full flex flex-wrap items-center justify-between shrink-0 border-t border-st-hairline pt-2 sm:pt-3 gap-3 sm:gap-4 md:justify-end"
          >
            {/* Time Display: strong mono readout (Bold port of the .tread row) */}
            <div
              data-testid="stem-player-time"
              className="flex items-baseline gap-1.5 font-mono text-[11px] bg-st-canvas px-3 py-1 rounded border border-st-hairline"
              style={{ fontFamily: MONO_FONT_STACK }}
            >
              <span className="text-white font-bold tracking-wider">
                {formatTime(currentTime)}
              </span>
              <span className="text-zinc-500 text-xs">/</span>
              <span className="text-zinc-400 text-xs">
                {formatTime(duration)}
              </span>
            </div>

            {/* Transport: single Play/Pause toggle (ADR-0008). Icon shows the
              action coming next: ▶ while paused, ⏸ while playing; one stable
              accessible name plus aria-pressed for assistive tech. The Seek-to-
              start button is gone; the Master Waveform spine is the timeline. */}
            <div className="flex items-center gap-2">
              <div className="relative flex flex-col items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Play/Pause"
                  aria-pressed={isPlaying}
                  title="Play/Pause (Space)"
                  onClick={togglePlayPause}
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-full border transition-all font-semibold shadow-sm active:scale-95",
                    isPlaying
                      ? "bg-st-coral text-white border-st-coral shadow-play-glow hover:bg-st-coral"
                      : "bg-st-panel text-zinc-300 border-st-hairline hover:bg-st-surface hover:text-white"
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

                {/* Honest transport status (Stitch skin): how many stems are wired
                and whether the Beat Grid is latched. Never claims a number the
                engine has not reported; sm+ only, decorative. */}
                <span
                  aria-hidden="true"
                  className="hidden flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.18em] shrink-0 sm:flex"
                >
                  {beatGrid ? (
                    <>
                      <span className="rounded-full h-1.5 w-1.5 bg-st-ok shrink-0" />
                      <span className="text-st-ink-dim">
                        4 stems · phase-locked
                      </span>
                    </>
                  ) : (
                    <span className="text-st-ink-dim">
                      4 stems · phase open
                    </span>
                  )}
                </span>
              </div>

              {/* ADR-0008 (ticket 04): the trash / Purge Session button is dead —
                nothing destructive sits in the playback surface. The full purge
                is the Separate Tab's Session Recovery Discard. */}

              {/* Export Stems Action — standalone form only. The hosted app
                form (exportDialogHosted) keeps the Export panel inline in the
                Export Tab, so the Mix Tab never carries this action. */}
              {!exportDialogHosted && (
                <button
                  type="button"
                  aria-label="Export Stems"
                  title="Export isolated stems (WAV/MP3/ZIP)"
                  onClick={() => setIsExportDialogOpen(true)}
                  className="px-3 py-1 rounded border border-st-hairline bg-st-surface text-zinc-400 hover:text-white font-mono font-semibold text-[10px] flex items-center gap-2 transition-colors"
                >
                  <Download className="h-4 w-4 text-primary" />
                  <span>Export Stems</span>
                </button>
              )}
            </div>

            {/* Master Volume Slider */}
            <div className="flex items-center gap-2 pl-2 border-s border-st-hairline/60">
              <span className="font-mono text-[10px] uppercase font-semibold text-st-ink-dim shrink-0">
                Master
              </span>
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
                className="flex-1 min-w-[96px] accent-primary cursor-pointer h-1.5 bg-secondary rounded appearance-none"
              />
              <span className="font-mono text-[10px] font-bold text-zinc-200 w-7 text-right">
                {Math.round(masterVolume * 100)}%
              </span>
            </div>
          </div>
        )}

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
    </>
  );
};
