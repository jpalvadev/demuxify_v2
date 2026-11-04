import React, { useRef, useState, useCallback } from "react";
import {
  calibrateClickGrid,
  CalibratedClickGrid,
  ClickCalibrationRejection,
} from "../lib/stemPlayerEngine";
import { cn } from "../lib/utils";
import { MONO_FONT_STACK } from "../lib/typography";

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
  // Mix Tab cohesion (ADR-0013, ticket 09): the card's tall default died —
  // the lane is a thin strip welded under the spine, same time axis.
  height = 24,
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
        // Mix Tab cohesion (ADR-0013): the card look is dead — the lane is a
        // thin strip on the spine's width and time axis: no border rhythm, no
        // outer padding, no height default. The decision contract stays whole.
        "flex flex-col gap-1 items-end rounded bg-transparent px-0 py-0",
        className
      )}
    >
      {/* The tap strip: one tap per press along the timeline; taps stand as
          lime ticks so the pattern the user heard stays visible. */}
      <div
        ref={stripRef}
        data-testid="click-tap-calibration-strip"
        onPointerDown={handlePointerDown}
        role="group"
        aria-label="Tap beats along the timeline"
        className={cn(
          // Stitch skin 07p: the mockup shows NO visible lane between the
          // waveform and the BPM chips — its tap chrome is a one-line right
          // row, so the live gesture strip fades to a phantom hairline on a
          // panel wash (barely-there, like the mockup's phantom strips) and
          // the lane's lines right-align under the spine.
          "relative w-full overflow-hidden select-none rounded border border-st-hairline/30 bg-st-panel focus-visible:outline-none",
          disabled && "opacity-60 pointer-events-none"
        )}
        style={{ height: `${height}px` }}
      >
        {taps.map((tapSec, index) => (
          <span
            key={`${index}-${tapSec}`}
            aria-hidden="true"
            className="absolute top-0 w-px-2 h-full bg-st-coral opacity-90 pointer-events-none"
            style={{
              left: `${duration > 0 ? (tapSec / duration) * 100 : 0}%`,
            }}
          />
        ))}
      </div>

      <div
        data-testid="click-tap-calibration-readout"
        className="block text-[10px] font-mono italic text-st-ink-dim"
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
            // Stitch skin 07i: mockup Confirm chip — accentMuted ground,
            // hairline coral rim, coral ink; coral fill + white on hover.
            "px-2.5 py-1 rounded bg-st-coral/15 border border-st-coral/40 text-st-coral font-semibold hover:bg-st-coral hover:text-white hover:border-st-coral transition-colors text-[10px] font-mono disabled:opacity-40 disabled:cursor-not-allowed"
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
            // Stitch skin 07i: mockup Reset chip — zinc surface, hairline rim,
            // dim ink lifting to ink on hover.
            "px-2 py-1 rounded bg-st-surface border border-st-hairline text-st-ink-dim hover:text-st-ink font-mono font-semibold text-[10px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          Reset taps
        </button>
      </div>
    </section>
  );
};
