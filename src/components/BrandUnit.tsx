import React from "react";
import { DISPLAY_FONT_STACK, MONO_FONT_STACK } from "../lib/typography";

// Brand Unit (ADR-0009 rail-hosted chrome, re-composed for Stitch Skin by
// ADR-0014): the identity lockup owns the head cell of the sticky Tab Band at
// every breakpoint — the wordmark cell sits above the four chip pills inside
// the same band. Stitch marks: the coral rounded-square badge carries the
// white diamond glyph (the Waves icon is retired with the Grizzlython skin),
// the `Demuxify` wordmark is mixed-case, and the 8px status dot pulses on the
// coral ink. Same lockup parts everywhere; the mono tagline stays Band-hosted
// (`hidden md:block`) so the mobile lockup stays reduced. The lockup is flush
// on the canvas with no bordered card around it; the air before the first chip
// (Band gap + lockup margin) is space, never a rule.
//
// The font-family declarations stay inlined on the focal branding nodes so the
// css-asserted app-shell seam can read the applied faces through
// getComputedStyle; the Tailwind `font-display`/`font-mono` utilities carry the
// same Inter/JetBrains Mono stacks everywhere else.
export const BrandUnit: React.FC = () => {
  return (
    <div
      data-testid="brand-unit"
      className="flex flex-col items-start gap-0 shrink-0 col-span-4 md:mb-2"
    >
      <div className="flex items-center gap-3">
        <div
          data-testid="brand-unit-mark"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-st-coral"
        >
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rotate-45 bg-st-ink"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1
            className="font-display text-lg md:text-xl font-black tracking-wide text-foreground"
            style={{ fontFamily: DISPLAY_FONT_STACK }}
          >
            Demuxify
          </h1>
          {/* .brand i: 8px accent status dot (dark-only state marker) */}
          <span
            data-testid="brand-unit-status-dot"
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse"
          />
        </div>
      </div>

      <p
        className="hidden md:block font-mono text-xs font-medium tracking-wide text-muted-foreground"
        style={{ fontFamily: MONO_FONT_STACK }}
      >
        Client-Side Stem Separation
      </p>
    </div>
  );
};
