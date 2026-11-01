import React from "react";
import { Waves } from "lucide-react";
import { DISPLAY_FONT_STACK, MONO_FONT_STACK } from "../lib/typography";

// Brand Unit (ADR-0009 rail-hosted chrome): the identity lockup re-homed from the
// dead page-level header into the head of the Tab Rail, above the four Tab chips.
// Same Bold lockup parts — icon mark in its bordered box, `DEMUXIFY` display
// wordmark (still the document's single top-level heading), 8px pulsing status
// dot — plus the mono tagline, which is rail-only (`hidden md:block`): the mobile
// brand row uses the reduced lockup without it. The lockup is flush on the canvas
// with no bordered card around it, since the rail chips already own the rail's
// borders; the air before the first chip (rail gap + lockup margin) is ~16px of
// space, never a rule.
//
// The font-family declarations stay inlined on the focal branding nodes so the
// css-asserted app-shell seam can read the applied faces through
// getComputedStyle; the Tailwind `font-display`/`font-mono` utilities carry the
// same stacks everywhere else.
export const BrandUnit: React.FC = () => {
  return (
    <div
      data-testid="brand-unit"
      className="hidden md:flex flex-col items-start gap-0 shrink-0 md:mb-2"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-muted border border-border text-primary">
          <Waves className="h-4.5 w-4.5" />
        </div>
        <div className="flex items-center gap-2">
          <h1
            className="font-display text-transform-uppercase text-lg md:text-xl font-black tracking-wide text-foreground"
            style={{ fontFamily: DISPLAY_FONT_STACK }}
          >
            Demuxify
          </h1>
          {/* .brand i: 8px accent status dot (dark-only state marker) */}
          <span
            data-testid="brand-unit-status-dot"
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-none bg-primary grizzly-pulse"
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
