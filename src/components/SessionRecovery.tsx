import React from "react";
import { History, Play, Trash2, Loader2, Music } from "lucide-react";
import { cn } from "../lib/utils";

export interface SessionRecoveryProps {
  title: string;
  duration: number;
  onResume: () => void;
  onDiscard: () => void;
  isResuming?: boolean;
  className?: string;
}

function formatDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export const SessionRecovery: React.FC<SessionRecoveryProps> = ({
  title,
  duration,
  onResume,
  onDiscard,
  isResuming = false,
  className,
}) => {
  return (
    <aside
      aria-label="Previous Session Recovery"
      role="region"
      className={cn(
        "rounded border border-border/60 bg-card/95 p-4 sm:p-5 shadow-sm backdrop-blur-sm transition-all",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-secondary text-secondary-foreground">
            <History className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                <Music className="h-3 w-3" /> Auto-Saved Session
              </span>
            </div>
            <h3 className="mt-1 text-sm sm:text-base font-semibold text-foreground">
              Previous session found:{" "}
              <span className="text-primary">{title}</span> (
              {formatDuration(duration)}). Resume or Discard?
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Source Mix, separated Stems, and mixer levels were saved from your
              previous session.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
          <button
            type="button"
            aria-label="Discard Session"
            onClick={onDiscard}
            disabled={isResuming}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-border bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Discard</span>
          </button>

          <button
            type="button"
            aria-label={isResuming ? "Restoring Session..." : "Resume Session"}
            onClick={onResume}
            disabled={isResuming}
            className="inline-flex items-center justify-center gap-1.5 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-70 disabled:pointer-events-none"
          >
            {isResuming ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Restoring...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Resume Session</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
