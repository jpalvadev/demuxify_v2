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
    iso: string;
    nameText: string;
    isoText: string;
    badgeBg: string;
    waveBg: string;
    dotGlow: string;
    activeColor: string;
    inactiveColor: string;
  }
> = {
  vocals: {
    label: "Vocals",
    icon: Mic,
    badgeClass: "bg-stem-vocals/15 text-stem-vocals border-stem-vocals/40",
    activeColor: "#c084fc", // stem-vocals: hsl(270 95.2% 75.3%)
    inactiveColor: "rgba(192, 132, 252, 0.25)",
    iso: "ISO-1",
    nameText: "text-purple-300",
    isoText: "text-purple-400/70",
    badgeBg: "#1b1724",
    waveBg: "#0d0c13",
    dotGlow: "#c084fc",
  },
  drums: {
    label: "Drums",
    icon: Drum,
    badgeClass: "bg-stem-drums/15 text-stem-drums border-stem-drums/40",
    activeColor: "#818cf8", // stem-drums: hsl(234 89.5% 73.9%)
    inactiveColor: "rgba(129, 140, 248, 0.25)",
    iso: "ISO-2",
    nameText: "text-indigo-300",
    isoText: "text-indigo-400/70",
    badgeBg: "#171827",
    waveBg: "#0b0c16",
    dotGlow: "#818cf8",
  },
  bass: {
    label: "Bass",
    icon: Radio,
    badgeClass: "bg-stem-bass/15 text-stem-bass border-stem-bass/40",
    activeColor: "#f59e0b", // stem-bass: hsl(38 92.1% 50.2%)
    inactiveColor: "rgba(245, 158, 11, 0.25)",
    iso: "ISO-3",
    nameText: "text-amber-300",
    isoText: "text-amber-400/70",
    badgeBg: "#221c13",
    waveBg: "#130f08",
    dotGlow: "#f59e0b",
  },
  other: {
    label: "Other",
    icon: Music,
    badgeClass: "bg-stem-other/15 text-stem-other border-stem-other/40",
    activeColor: "#22d3ee", // stem-other: hsl(188 85.7% 53.3%)
    inactiveColor: "rgba(34, 211, 238, 0.25)",
    iso: "ISO-4",
    nameText: "text-cyan-300",
    isoText: "text-cyan-400/70",
    badgeBg: "#121f24",
    waveBg: "#091114",
    dotGlow: "#22d3ee",
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
    ctx.fillStyle = isSilenced ? "#080a10" : config.waveBg; // Stitch skin: the mockup's per-stem tinted waveform field
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
        } else {
          // Stitch skin 07g: the mockup paints ONE uniform stem-tinted
          // envelope across the whole field — no played/unplayed dimming.
          ctx.fillStyle = config.activeColor;
        }

        ctx.fillRect(x, yTop, Math.max(1, binWidth - 0.5), barHeight);
      }
    }

    // Draw playhead cursor
    if (duration > 0) {
      if (isSilenced) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      } else {
        // Stitch skin 07g: the mockup's scrubber mark is the STEM's own
        // tint at 80% (bg-purple-300/80 on Vocals), not a white hairline.
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = config.activeColor;
      }
      ctx.lineWidth = 2;
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
        "group flex flex-col sm:flex-row items-stretch sm:items-center rounded border border border-st-hairline/80 hover:border-zinc-700 transition-colors overflow-hidden bg-st-surface shadow-xs",
        isSilenced && "opacity-65 bg-card/30",
        className
      )}
    >
      {/* Channel header badge (Stitch skin): the mockup's tinted badge column —
            glowing stem dot + mono bold stem-tinted name + ISO identity tag. The
            grizzly-era lucide stem icons are gone; the dot carries the identity. */}
      <div
        className="flex w-32 shrink-0 items-center px-3 justify-between rounded-none border-e border-st-hairline/80"
        style={{ backgroundColor: config.badgeBg }}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: config.activeColor,
              boxShadow: `0 0 6px ${config.dotGlow}`,
            }}
          />
          <span className={cn("font-mono font-bold text-xs", config.nameText)}>
            {config.label}
          </span>
        </div>
        <span className={cn("text-[9px] font-mono", config.isoText)}>
          {config.iso}
        </span>
      </div>

      {/* Waveform Display Area (Stitch skin): the mockup's borderless tinted
            waveform field — the canvas paints the per-stem wash itself now. */}
      <div
        ref={containerRef}
        onClick={handleWaveformClick}
        role="presentation"
        className="relative flex-1 overflow-hidden cursor-pointer min-w-[120px]"
        style={{ height }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Channel Controls Rack (Stitch skin): the mockup's w-64 rack welded to
            the field with a hairline; compact mono M/S caps, speaker, slider,
            and a w-8 percent readout. Behavior, aria, and handlers untouched. */}
      <div className="flex items-center px-3 space-x-3 w-64 shrink-0 bg-st-panel rounded-none border-s border-st-hairline/80">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Mute ${config.label}`}
            aria-pressed={muted}
            onClick={onToggleMute}
            title={`Mute ${config.label}`}
            className={cn(
              "h-6 w-6 rounded border font-mono font-bold text-[10px] flex items-center justify-center transition-colors",
              muted
                ? "border-st-danger bg-st-danger text-st-surface"
                : "border-zinc-700 bg-st-surface text-zinc-400 hover:text-white"
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
              "h-6 w-6 rounded border font-mono font-bold text-[10px] flex items-center justify-center transition-colors",
              solo
                ? "border-st-coral bg-st-coral text-st-surface shadow-chip-glow"
                : cn(
                    "border-zinc-700 bg-st-surface hover:text-white",
                    config.nameText
                  )
            )}
          >
            S
          </button>
        </div>

        <div className="flex-1 flex items-center gap-2">
          {muted || isSilenced ? (
            <VolumeX className="h-3 w-3 text-st-ink-faint shrink-0" />
          ) : (
            <Volume2 className="h-3 w-3 text-zinc-400 shrink-0" />
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label={`${config.label} Volume`}
            className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded appearance-none"
          />
          <span className="font-mono text-[10px] text-st-ink-dim w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
