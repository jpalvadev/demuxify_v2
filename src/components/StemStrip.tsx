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
    nameText: string;
    badgeBgClass: string;
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
    nameText: "text-purple-300",
    // Stitch skin 10: the badge column tint is desktop-only (sm:). Literal
    // strings so Tailwind's content scan emits the arbitrary bg classes.
    badgeBgClass: "sm:bg-[#1b1724]",
    waveBg: "#0d0c13",
    dotGlow: "#c084fc",
  },
  drums: {
    label: "Drums",
    icon: Drum,
    badgeClass: "bg-stem-drums/15 text-stem-drums border-stem-drums/40",
    activeColor: "#818cf8", // stem-drums: hsl(234 89.5% 73.9%)
    inactiveColor: "rgba(129, 140, 248, 0.25)",
    nameText: "text-indigo-300",
    badgeBgClass: "sm:bg-[#171827]",
    waveBg: "#0b0c16",
    dotGlow: "#818cf8",
  },
  bass: {
    label: "Bass",
    icon: Radio,
    badgeClass: "bg-stem-bass/15 text-stem-bass border-stem-bass/40",
    activeColor: "#f59e0b", // stem-bass: hsl(38 92.1% 50.2%)
    inactiveColor: "rgba(245, 158, 11, 0.25)",
    nameText: "text-amber-300",
    badgeBgClass: "sm:bg-[#221c13]",
    waveBg: "#130f08",
    dotGlow: "#f59e0b",
  },
  other: {
    label: "Other",
    icon: Music,
    badgeClass: "bg-stem-other/15 text-stem-other border-stem-other/40",
    activeColor: "#22d3ee", // stem-other: hsl(188 85.7% 53.3%)
    inactiveColor: "rgba(34, 211, 238, 0.25)",
    nameText: "text-cyan-300",
    badgeBgClass: "sm:bg-[#121f24]",
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

    // Center guide line (the mockup's guide: rgba(255,255,255,0.05))
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Draw waveform bars
    if (effectivePeaks && effectivePeaks.length > 0) {
      const numBins = effectivePeaks.length;
      const binWidth = width / numBins;
      // Mockup amplitude cap: bars reach 92% of the half-height (midY * 0.92)
      const halfHeight = (canvasHeight / 2) * 0.92;

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
        // Stitch skin 10 (stem-card fidelity pass): flex-wrap layout — the
        // mobile target renders a 3-line card (header row: badge + M/S + %;
        // full-width waveform; full-width slider row), the sm+ target the
        // mockup's single h-14 row (badge | waveform | rack). Controls are
        // rendered ONCE: flex order classes swap the pieces between layouts
        // (from sm+ the slider wrapper IS the rack strip — the
        // sm:bg-st-surface-light band carrying speaker + slider + %).
        // Behavior, aria, and handlers untouched.
        "group flex flex-wrap items-center gap-y-2.5 rounded-lg border border border-st-hairline/80 hover:border-zinc-700 transition-colors overflow-hidden bg-st-panel shadow-xs sm:h-14 sm:flex-nowrap sm:items-center sm:gap-y-0 sm:rounded",
        isSilenced && "opacity-65 bg-card/30",
        className
      )}
    >
      {/* Channel header badge (Stitch skin 10): mobile — transparent badge
          riding the header row's left, dot + name; desktop — the mockup's
          w-32 tinted badge column with hairline seam. */}
      <div
        className={cn(
          "order-1 flex flex-1 items-center gap-2 px-3 py-2 sm:h-full sm:flex-none sm:w-32 sm:justify-between sm:border-e sm:border-st-hairline sm:py-0",
          config.badgeBgClass
        )}
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
      </div>

      {/* M/S group (Stitch skin 10b): mobile — right end of the header row
          (the target's `M S` pair riding before the % readout); desktop — the
          rack's M/S block welded to the rack hairline. Single instance; order
          classes do the moving. Compact mono M/S caps. Behavior, aria, and
          handlers untouched. */}
      <div className="order-2 ml-auto flex shrink-0 items-center gap-1 py-2 pr-1 sm:order-3 sm:h-full sm:py-0 sm:ml-0 sm:border-s sm:border-st-hairline sm:bg-st-surface-light sm:pl-3 sm:pr-0">
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

      {/* Volume readout (Stitch skin 10b/10c, the user's rack-crop fix): the
          mobile header closes with `M S 100%` (target); from sm+ the readout
          lives at the mockup's rack END — inside the rack strip, after
          speaker + slider. Two spans, one visible per viewport (display
          swaps, single instance per breakpoint; no % test pins). */}
      <span className="order-3 w-9 shrink-0 pr-3 text-right font-mono text-[10px] text-st-ink-dim sm:hidden">
        {Math.round(volume * 100)}%
      </span>

      {/* Waveform Display Area (Stitch skin 10): mobile — full-width bordered
          rounded field on its own line; desktop — the mockup's borderless
          flex-1 field welded between badge and rack. The canvas paints the
          per-stem wash itself. */}
      <div
        ref={containerRef}
        onClick={handleWaveformClick}
        role="presentation"
        className="order-4 mx-3 basis-full w-full cursor-pointer overflow-hidden rounded-md border border-st-hairline/60 sm:mx-0 sm:order-2 sm:flex-1 sm:basis-auto sm:rounded-none sm:border-0 sm:h-full sm:min-w-[120px]"
        style={{ height }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Volume row (Stitch skin 10c, user 2026-11-05 "#202028"): mobile —
          full-width slider row below the waveform (the target's slim track +
          coral knob, no speaker); desktop — the mockup's rack strip itself:
          ONE continuous brand-surfaceLight #202028 band welded to the M/S
          block's hairline, carrying speaker + slider + % readout. Single
          slider instance, aria pinned. */}
      <div className="order-5 flex w-full items-center gap-2 px-3 pb-2 sm:order-4 sm:h-full sm:w-auto sm:flex-none sm:bg-st-surface-light sm:px-3 sm:pb-0">
        {muted || isSilenced ? (
          <VolumeX className="hidden h-3 w-3 shrink-0 text-st-ink-faint sm:block" />
        ) : (
          <Volume2 className="hidden h-3 w-3 shrink-0 text-zinc-400 sm:block" />
        )}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-label={`${config.label} Volume`}
          className="h-4 w-full flex-1 cursor-pointer accent-primary sm:w-40 sm:flex-none"
        />
        <span className="hidden w-9 shrink-0 text-right font-mono text-[10px] text-st-ink-dim sm:inline-block">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
};
