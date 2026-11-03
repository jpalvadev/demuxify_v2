import React, { useRef, useState, useCallback } from "react";
import {
  calibrateClickGrid,
  CalibratedClickGrid,
  ClickCalibrationRejection,
} from "../lib/stemPlayerEngine";
import { cn } from "../lib/utils";
import { DISPLAY_FONT_STACK, MONO_FONT_STACK } from "../lib/typography";

// Calibrate the Click (ticket 08): the honest manual route. The user taps
// beats on the groove they hear along the Mix Tab's waveform spine; this strip
// captures those taps and, once enough of them describe a steady pulse, hands
// them to the engine's calibrateClickGrid at confirm time. Ragged taps never
// become a half-calibration: the readout names why they refused, and confirm
// stays disabled. Look is agent-authored (OpenDesign MCP dead this session —
// recorded on ticket 08).

export interface BeatGridTapCalibrationProps {
  duration: number;
  disabled?: boolean;
  onTapCalibration?: (tapsSec: number[]) => void;
  className?: string;
  height?: number;
}

// Four taps are the contract; eight is the hard cap so a mash of clicks
// cannot drown the readout — the user resets instead.
const TAPS_REQUIRED = 4;
const TAPS_CAP = 8;

function formatGapSec(gapSec: number): string {
  return gapSec.toFixed(3);
}

function describeCalibration(calibration: CalibratedClickGrid): string {
  return `${calibration.tapsSec.length} taps · pulse ${Math.round(calibration.pulseSec * 1000)} ms · ${calibration.bpm.toFixed(1)} BPM`;
}

function describeRejection(refusal: ClickCalibrationRejection): string {
  switch (refusal.reason) {
    case "too-few-taps":
      return "need at least 3 taps before anything is derived";
    case "taps-too-close":
      return `refused honestly · a ${formatGapSec(refusal.detailSec ?? 0)} s gap is faster than 240 BPM`;
    case "taps-too-far":
      return `refused honestly · a ${formatGapSec(refusal.detailSec ?? 0)} s gap is slower than 24 BPM`;
  }
}

export const BeatGridTapCalibration: React.FC<BeatGridTapCalibrationProps> = ({
  duration,
  disabled = false,
  onTapCalibration,
  className,
  height = 64,
}) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const [taps, setTaps] = useState<number[]>([]);

  // One calibration reading for the whole component: the taps, the derived
  // grid, and the refusal all come from this single call, so no surface can
  // disagree with another about whether these taps mean anything.
  const calibrationResult = calibrateClickGrid(taps);

  const handleAddTap = useCallback(
    (clientX: number) => {
      if (disabled || duration <= 0) return;
      const strip = stripRef.current;
      if (!strip) return;

      const rect = strip.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;

      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      // Taps are positions on the timeline: rounded to milliseconds so a
      // pointer jitter never invents sub-millisecond pulse noise.
      const tapSec = Math.round(ratio * duration * 1000) / 1000;

      setTaps((current) => {
        if (current.length >= TAPS_CAP) return current;
        return [...current, tapSec];
      });
    },
    [disabled, duration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    handleAddTap(e.clientX);
  };

  return (
    <section
      aria-label="Beat Grid tap calibration"
      className={cn(
        "flex flex-col gap-2 rounded-none border border-border/60 bg-card/60 px-3 py-2",
        className
      )}
    >
      <span
        className="block text-[11px] font-semibold tracking-wide uppercase text-muted-foreground"
        style={{ fontFamily: DISPLAY_FONT_STACK }}
      >
        Calibrate the Click
      </span>

      {/* The tap strip: one tap per press along the timeline; taps stand as
          lime ticks so the pattern the user heard stays visible. */}
      <div
        ref={stripRef}
        data-testid="click-tap-calibration-strip"
        onPointerDown={handlePointerDown}
        role="group"
        aria-label="Tap beats along the timeline"
        className={cn(
          "relative w-full overflow-hidden select-none rounded-none border border-primary/30 bg-secondary/60 focus-visible:outline-none",
          disabled && "opacity-60 pointer-events-none"
        )}
        style={{ height: `${height}px` }}
      >
        {taps.map((tapSec, index) => (
          <span
            key={`${index}-${tapSec}`}
            aria-hidden="true"
            className="absolute top-0 w-px-2 h-full bg-primary opacity-90 pointer-events-none"
            style={{
              left: `${duration > 0 ? (tapSec / duration) * 100 : 0}%`,
            }}
          />
        ))}
      </div>

      <div
        data-testid="click-tap-calibration-readout"
        className="block text-[11px] font-mono text-muted-foreground"
        style={{ fontFamily: MONO_FONT_STACK }}
      >
        {calibrationResult.kind === "calibrated"
          ? describeCalibration(calibrationResult)
          : taps.length === 0
            ? `tap ${TAPS_REQUIRED} beats on the groove to anchor the Beat Grid by hand`
            : taps.length < 3
              ? `${taps.length} of ${TAPS_REQUIRED} taps`
              : describeRejection(calibrationResult)}
      </div>

      <div className="flex items-center gap-2">
        {/* Confirm hands the taps to the app only while they describe a
            steady pulse: ragged taps keep this disabled, never silent. */}
        <button
          type="button"
          data-testid="click-tap-calibration-confirm"
          disabled={
            !onTapCalibration || calibrationResult.kind !== "calibrated"
          }
          onClick={() => {
            onTapCalibration?.(taps);
          }}
          aria-label="Confirm hand calibration of the Beat Grid"
          className={cn(
            "px-2 py-1 rounded-none border border-primary/70 bg-primary/20 text-primary text-[11px] font-semibold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          Confirm hand calibration
        </button>
        <button
          type="button"
          data-testid="click-tap-calibration-reset"
          disabled={disabled || taps.length === 0}
          onClick={() => {
            setTaps([]);
          }}
          aria-label="Reset the hand-calibration taps"
          className={cn(
            "px-2 py-1 rounded-none border border-border/70 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground text-[11px] font-semibold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          Reset taps
        </button>
      </div>
    </section>
  );
};
