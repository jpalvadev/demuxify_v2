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
  // Stitch skin 07y (mock meta bar = one justify-between row): an optional
  // inline right-side cluster — the Mix Tab welds the Beat Grid tap chrome
  // into the spine's own title row. Pure render slot; no engine reach-in.
  metaRight?: React.ReactNode;
}

function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
  metaRight,
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

    // Stitch skin 07i: the mockup's master field carries exactly ONE ruler —
    // the DOM row at the top of the box — and the canvas only draws the
    // midline guide + waveform. The canvas-drawn bottom ruler + tick lines
    // (the old second ruler) are gone with it.

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

        // Stitch skin 07h: the mockup renders the master with ONE neon-lime
        // trace across the whole field (`drawDetailedAudioWaveform(…,
        // '#39ff14')`) — no played/unplayed split.
        ctx.fillStyle = "#39ff14"; // neon lime master

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

      // Playhead head cap — Stitch skin 07s: the mockup's Playhead wears a
      // rotated-square diamond knob at the crown (w-2.5 h-2.5 rotate-45), not
      // a triangle; same white glow.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(playheadX, 3);
      ctx.lineTo(playheadX + 7, 10);
      ctx.lineTo(playheadX, 17);
      ctx.lineTo(playheadX - 7, 10);
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
        // Stitch skin 07r band head: the mockup's master panel is ONE tall
        // container (header bar, canvas, chip grid inside). The card is now
        // the TOP segment of that band — open at the foot so the tap lane and
        // the chip rail continue the same wash and hairline below it.
        "group relative w-full overflow-hidden rounded-t-lg border-x border-t border-st-hairline bg-st-panel p-3 shadow-sm transition-all select-none",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      {/* Header with Title and Overview chip (ADR-0013: the spine's own
          mm:ss / mm:ss group died — the Transport is the Mix Tab's clock).
          Stitch skin 07y: the mock's meta bar is ONE justify-between row —
          title cluster left, the tap chrome cluster right (flex-wrap keeps
          the cluster legible on the narrow mobile band). */}
      <div className="flex items-center flex-wrap justify-between gap-2 font-mono text-[11px] pb-1 border-b border-st-hairline/60 mb-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold tracking-wider uppercase text-zinc-200">
            Master Waveform
          </span>
          <span className="font-sans text-[10px] text-zinc-500">Overview</span>
          <span className="px-2 py-1 rounded bg-zinc-800 text-[9px] uppercase tracking-wider text-zinc-400 hover:text-zinc-200 shrink-0">
            Stereo Mix
          </span>
        </div>
        {metaRight}
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
          "relative w-full rounded border border-st-hairline bg-[#0a0a0d] overflow-hidden cursor-pointer touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          isScrubbing && "cursor-ew-resize"
        )}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          style={{ height: `${height}px` }}
        />
        {/* Timeline graduations (Stitch skin): the mockup's ruler marks over
            the field — honest labels of the spine's own time axis, aria-hidden. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex justify-between pointer-events-none px-2 pt-1 text-[9px] font-mono text-zinc-600 select-none"
        >
          {Array.from({ length: 8 }).map((_, mark) => (
            <span key={mark}>
              {`${Math.floor(((duration / 7) * mark) / 60)}:${String(Math.floor(((duration / 7) * mark) % 60)).padStart(2, "0")}`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
