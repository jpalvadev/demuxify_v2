import React from "react";
import { DISPLAY_FONT_STACK, MONO_FONT_STACK } from "../lib/typography";

// Brand Unit (ADR-0009 rail-hosted chrome; 06b stitch.html port): the identity
// lockup opens the sticky Tab Band at every breakpoint — beside the bordered
// chip-container at md+, above it below-md. Mockup marks verbatim: the mark is
// a bordered surface tile with a glowing coral diamond, the `Demuxify` wordmark
// is mixed-case Inter bold at text-sm, the 6px coral status dot pulses, and the
// mono tagline is always visible as a 9px uppercase micro-line. The lockup is
// flush on the canvas with no bordered card around it — the chip container
// owns its own hairline, the lockup never borrows it.
//
// The font-family declarations stay inlined on the focal branding nodes so the
// css-asserted app-shell seam can read the applied faces through
// getComputedStyle; the Tailwind `font-display`/`font-mono` utilities carry the
// same Inter/JetBrains Mono stacks everywhere else.
export const BrandUnit: React.FC = () => {
  return (
    <div
      data-testid="brand-unit"
      className="flex flex-col items-start gap-2 shrink-0"
    >
      <div className="flex items-center gap-3">
        <div
          data-testid="brand-unit-mark"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-st-surface border border-st-hairline"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm bg-st-coral shadow-mark-glow"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1
            className="font-display text-sm font-bold tracking-tight text-white"
            style={{ fontFamily: DISPLAY_FONT_STACK }}
          >
            Demuxify
          </h1>
          {/* .brand i: 8px accent status dot (dark-only state marker) */}
          <span
            data-testid="brand-unit-status-dot"
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
          />
        </div>
      </div>

      <p
        className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
        style={{ fontFamily: MONO_FONT_STACK }}
      >
        Client-Side Stem Separation
      </p>
    </div>
  );
};
