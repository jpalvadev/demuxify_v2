import React from "react";
import { Waves, Moon, Sun, ShieldCheck } from "lucide-react";

interface HeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme }) => {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
                Demuxify
              </h1>
              <span className="hidden sm:inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Web
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Client-Side Stem Separation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground"
            title="All audio processing stays on your device (100% private, zero uploads)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Private &amp; Offline</span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="rounded-xl border border-border bg-card p-2 text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
