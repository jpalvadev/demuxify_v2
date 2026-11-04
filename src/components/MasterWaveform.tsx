import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { WaveformPeaks, computeWaveformPeaks } from "../lib/waveformPeaks";
import { cn } from "../lib/utils";

export interface MasterWaveformProps {
  peaks?: WaveformPeaks | null;
  audioBuffer?: AudioBuffer | null;
  duration: number;
  currentTime?: number;
  onSeek?: (seekTime: number) => void;
  height?: number;
  className?: string;
  disabled?: boolean;
}

function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function calculateTickInterval(duration: number): number {
  if (duration <= 15) return 2;
  if (duration <= 30) return 5;
  if (duration <= 60) return 10;
  if (duration <= 180) return 15;
  if (duration <= 360) return 30;
  if (duration <= 720) return 60;
  return 120;
}

// Mix Tab cohesion (ADR-0013): the spine carries a live Playhead, so its canvas
// repaint runs at a ceiling near fifteen draws per second instead of once per
// position update. The position value itself keeps flowing every frame — the
// assistive readout is never a stale approximation, only the paint cadence is.
const PLAYHEAD_REPAINT_CEILING_MS = 66;

export const MasterWaveform: React.FC<MasterWaveformProps> = ({
  peaks: providedPeaks,
  audioBuffer,
  duration,
  currentTime = 0,
  onSeek,
  height = 110,
  className,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPaintAtRef = useRef(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);

  // Compute peaks if not directly passed
  const effectivePeaks = useMemo(() => {
    if (providedPeaks) return providedPeaks;
    if (audioBuffer) {
      return computeWaveformPeaks(audioBuffer, {
        targetBins: Math.max(200, Math.floor(containerWidth)),
      });
    }
    return null;
  }, [providedPeaks, audioBuffer, containerWidth]);

  // Handle container resize
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

  // Draw canvas waveform — time-gated (ADR-0013): the live Playhead's position
  // flows every frame, but the canvas repaints at the ceiling only.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const now = Date.now();
    if (now - lastPaintAtRef.current < PLAYHEAD_REPAINT_CEILING_MS) return;
    lastPaintAtRef.current = now;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = containerWidth;
    const canvasHeight = height;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(canvasHeight * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.clearRect(0, 0, width, canvasHeight);

    // Background fill (st-waveform-box: hsl(240 13% 4.5%) = #0a0a0d, Stitch Skin)
    ctx.fillStyle = "#0a0a0d";
    ctx.fillRect(0, 0, width, canvasHeight);

    // Calculate playhead pixel position
    const playheadRatio =
      duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    const playheadX = playheadRatio * width;

    // Draw timeline grid ticks
    const tickInterval = calculateTickInterval(duration);
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let t = 0; t <= duration; t += tickInterval) {
      const tickX = duration > 0 ? (t / duration) * width : 0;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tickX, 0);
      ctx.lineTo(tickX, canvasHeight);
      ctx.stroke();

      // Render tick time labels at bottom (--muted-foreground)
      ctx.fillStyle = "rgba(136, 138, 149, 0.5)";
      ctx.fillText(formatTime(t), tickX, canvasHeight - 14);
    }

    // Midline
    const midY = (canvasHeight - 16) / 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Draw peaks if available
    if (effectivePeaks && effectivePeaks.length > 0) {
      const numBins = effectivePeaks.length;
      const binWidth = width / numBins;
      const halfHeight = midY * 0.92;

      for (let i = 0; i < numBins; i++) {
        const x = i * binWidth;
        const maxVal = effectivePeaks.max[i];
        const minVal = effectivePeaks.min[i]; // negative or 0

        const yTop = midY - maxVal * halfHeight;
        const yBottom = midY - minVal * halfHeight;
        const barHeight = Math.max(1, yBottom - yTop);

        // Highlight played portion (electric lime) / unplayed (--fg-2 dim)
        if (x <= playheadX) {
          ctx.fillStyle = "#39ff14"; // electric lime trace: hsl(95 100% 54%)
        } else {
          ctx.fillStyle = "rgba(179, 180, 188, 0.35)"; // fg-2: hsl(232 6% 72%)
        }

        ctx.fillRect(x, yTop, Math.max(1, binWidth - 0.5), barHeight);
      }
    }

    // Draw playhead cursor line
    if (duration > 0) {
      ctx.shadowColor = "rgba(255, 255, 255, 0.85)"; // white Playhead with glow (Stitch Skin)
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.stroke();

      // Playhead head cap
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }, [effectivePeaks, duration, currentTime, containerWidth, height]);

  // Scrubbing calculation helper
  const handleSeekFromClientX = useCallback(
    (clientX: number) => {
      if (disabled || !onSeek || duration <= 0) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;

      const validClientX =
        typeof clientX === "number" && !isNaN(clientX) ? clientX : 0;
      const offsetX = validClientX - rect.left;
      const ratio = Math.max(0, Math.min(1, offsetX / rect.width));
      const seekTime = ratio * duration;
      onSeek(Math.round(seekTime * 100) / 100);
    },
    [disabled, onSeek, duration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !onSeek) return;
    setIsScrubbing(true);
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignored if unsupported in environment
      }
    }
    handleSeekFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    handleSeekFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored if unsupported
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !onSeek || duration <= 0) return;

    let targetTime = currentTime;
    const step = e.shiftKey ? 1 : 5;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        targetTime = Math.min(duration, currentTime + step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        targetTime = Math.max(0, currentTime - step);
        break;
      case "Home":
        targetTime = 0;
        break;
      case "End":
        targetTime = duration;
        break;
      default:
        return;
    }

    e.preventDefault();
    onSeek(targetTime);
  };

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded border border-border bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all select-none",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      {/* Header with Title and Overview chip (ADR-0013: the spine's own
          mm:ss / mm:ss group died — the Transport is the Mix Tab's clock) */}
      <div className="mb-2.5 flex items-center justify-between text-xs font-mono text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-st-coral px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-primary-foreground shrink-0">
            Stereo Mix
          </span>
          <span className="font-semibold text-foreground tracking-wide uppercase text-[11px]">
            Master Waveform
          </span>
          <span className="rounded-full bg-st-surface border border-st-hairline px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em]">
            Overview
          </span>
        </div>
      </div>

      {/* Scrubbable Canvas Area */}
      <div
        ref={containerRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Master Waveform Timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={formatTime(currentTime)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative w-full rounded overflow-hidden cursor-pointer touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          isScrubbing && "cursor-ew-resize"
        )}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          style={{ height: `${height}px` }}
        />
      </div>
    </div>
  );
};
