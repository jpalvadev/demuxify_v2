import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Mic, Drum, Radio, Music, Volume2, VolumeX } from "lucide-react";
import { StemName } from "../lib/chunkOverlapAdd";
import { WaveformPeaks, computeWaveformPeaks } from "../lib/waveformPeaks";
import { StemMixerSettings } from "../lib/sessionStore";
import { cn } from "../lib/utils";

export interface StemStripProps {
  stem: StemName;
  settings?: StemMixerSettings;
  volume?: number;
  muted?: boolean;
  solo?: boolean;
  peaks?: WaveformPeaks | null;
  audioBuffer?: AudioBuffer | null;
  duration: number;
  currentTime: number;
  isSilenced?: boolean; // True when another stem is soloed or this stem is muted
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onSeek?: (seekTime: number) => void;
  height?: number;
  className?: string;
}

const STEM_CONFIG: Record<
  StemName,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    activeColor: string;
    inactiveColor: string;
  }
> = {
  vocals: {
    label: "Vocals",
    icon: Mic,
    badgeClass: "bg-stem-vocals/15 text-stem-vocals border-stem-vocals/40",
    activeColor: "#f452be", // stem-vocals: hsl(320 88% 64%)
    inactiveColor: "rgba(244, 82, 190, 0.25)",
  },
  drums: {
    label: "Drums",
    icon: Drum,
    badgeClass: "bg-stem-drums/15 text-stem-drums border-stem-drums/40",
    activeColor: "#a672f3", // stem-drums: hsl(264 84% 70%)
    inactiveColor: "rgba(166, 114, 243, 0.25)",
  },
  bass: {
    label: "Bass",
    icon: Radio,
    badgeClass: "bg-stem-bass/15 text-stem-bass border-stem-bass/40",
    activeColor: "#faa638", // stem-bass: hsl(34 95% 60%)
    inactiveColor: "rgba(250, 166, 56, 0.25)",
  },
  other: {
    label: "Other",
    icon: Music,
    badgeClass: "bg-stem-other/15 text-stem-other border-stem-other/40",
    activeColor: "#4bc5f1", // stem-other: hsl(196 86% 62%)
    inactiveColor: "rgba(75, 197, 241, 0.25)",
  },
};

export const StemStrip: React.FC<StemStripProps> = ({
  stem,
  settings,
  volume: looseVolume,
  muted: looseMuted,
  solo: looseSolo,
  peaks: providedPeaks,
  audioBuffer,
  duration,
  currentTime,
  isSilenced = false,
  onVolumeChange,
  onToggleMute,
  onToggleSolo,
  onSeek,
  height = 56,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(500);

  const volume = settings?.volume ?? looseVolume ?? 1;
  const muted = settings?.muted ?? looseMuted ?? false;
  const solo = settings?.solo ?? looseSolo ?? false;

  const config = STEM_CONFIG[stem];
  const Icon = config.icon;

  // Compute waveform peaks if not provided
  const effectivePeaks = useMemo(() => {
    if (providedPeaks) return providedPeaks;
    if (audioBuffer) {
      return computeWaveformPeaks(audioBuffer, {
        targetBins: Math.max(150, Math.floor(containerWidth)),
      });
    }
    return null;
  }, [providedPeaks, audioBuffer, containerWidth]);

  // Track container width updates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerWidth(rect.width);
      }
    };

    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(entry.contentRect.width);
          }
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, []);

  // Draw canvas waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = containerWidth;
    const canvasHeight = height;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(canvasHeight * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background fill
    ctx.clearRect(0, 0, width, canvasHeight);
    ctx.fillStyle = isSilenced ? "#080a10" : "#0c101a";
    ctx.fillRect(0, 0, width, canvasHeight);

    const playheadRatio =
      duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    const playheadX = playheadRatio * width;
    const midY = canvasHeight / 2;

    // Center guide line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Draw waveform bars
    if (effectivePeaks && effectivePeaks.length > 0) {
      const numBins = effectivePeaks.length;
      const binWidth = width / numBins;
      const halfHeight = (canvasHeight / 2) * 0.88;

      for (let i = 0; i < numBins; i++) {
        const x = i * binWidth;
        const maxVal = effectivePeaks.max[i];
        const minVal = effectivePeaks.min[i];

        const yTop = midY - maxVal * halfHeight;
        const yBottom = midY - minVal * halfHeight;
        const barHeight = Math.max(1, yBottom - yTop);

        if (isSilenced) {
          ctx.fillStyle = "rgba(100, 116, 139, 0.2)"; // Grayed out when silenced
        } else if (x <= playheadX) {
          ctx.fillStyle = config.activeColor;
        } else {
          ctx.fillStyle = config.inactiveColor;
        }

        ctx.fillRect(x, yTop, Math.max(1, binWidth - 0.5), barHeight);
      }
    }

    // Draw playhead cursor
    if (duration > 0) {
      ctx.strokeStyle = isSilenced ? "rgba(255, 255, 255, 0.3)" : "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.stroke();
    }

    ctx.restore();
  }, [
    effectivePeaks,
    duration,
    currentTime,
    containerWidth,
    height,
    isSilenced,
    config,
  ]);

  const handleWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek || duration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const offsetX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, offsetX / rect.width));
      onSeek(ratio * duration);
    },
    [onSeek, duration]
  );

  return (
    <div
      role="group"
      aria-label={`${config.label} Stem`}
      className={cn(
        "group flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-none border border-border bg-card/60 p-3 transition-colors shadow-xs",
        isSilenced && "opacity-65 bg-card/30",
        className
      )}
    >
      {/* Stem Label and Icon Badge */}
      <div className="flex items-center gap-2 sm:w-32 shrink-0">
        <div
          className={cn(
            "flex items-center gap-2 rounded-none border px-2.5 py-1 text-xs font-semibold shadow-xs",
            config.badgeClass
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span>{config.label}</span>
        </div>
      </div>

      {/* Waveform Canvas Area */}
      <div
        ref={containerRef}
        onClick={handleWaveformClick}
        role="presentation"
        className="relative flex-1 rounded-none overflow-hidden border border-border/40 cursor-pointer shadow-inner min-w-[120px]"
        style={{ height }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Mixer Controls: Mute & Solo buttons and Volume slider */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Mute ${config.label}`}
            aria-pressed={muted}
            onClick={onToggleMute}
            title={`Mute ${config.label}`}
            className={cn(
              "h-8 w-8 rounded-none border text-xs font-bold transition-all flex items-center justify-center",
              muted
                ? "border-destructive/60 bg-destructive text-destructive-foreground shadow-xs"
                : "border-border/70 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            M
          </button>
          <button
            type="button"
            aria-label={`Solo ${config.label}`}
            aria-pressed={solo}
            onClick={onToggleSolo}
            title={`Solo ${config.label}`}
            className={cn(
              "h-8 w-8 rounded-none border text-xs font-bold transition-all flex items-center justify-center",
              solo
                ? "border-primary/70 bg-muted text-foreground shadow-xs font-black"
                : "border-border/70 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            S
          </button>
        </div>

        {/* Volume Slider & Icon */}
        <div className="flex items-center gap-2 w-32 sm:w-36">
          {muted || isSilenced ? (
            <VolumeX className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          ) : (
            <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label={`${config.label} Volume`}
            className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-none appearance-none"
          />
          <span className="text-[11px] font-mono text-muted-foreground w-7 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
