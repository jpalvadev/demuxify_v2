import React from "react";
import { Waves } from "lucide-react";

// Bold skin (ticket 09): the artifact's `.brand` unit (Archivo Black wordmark,
// 8px accent status dot, mono status line). Dark-only: no theme toggle, no
// privacy shield pill.
export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border text-primary">
            <Waves className="h-4.5 w-4.5" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-transform-uppercase text-lg sm:text-xl font-black tracking-wide text-foreground">
              Demuxify
            </h1>
            {/* .brand i: 8px accent status dot (dark-only state marker) */}
            <span
              data-testid="header-status-dot"
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-primary"
            />
          </div>
        </div>

        <p className="hidden sm:block font-mono text-xs font-medium tracking-wide text-muted-foreground">
          Client-Side Stem Separation
        </p>
      </div>
    </header>
  );
};
