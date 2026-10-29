import React from 'react';
import { Download, Cpu, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { DownloadProgress } from '../lib/modelCache';
import { ChunkProgress } from '../lib/inferenceClient';

export type SeparationPhase =
  | 'idle'
  | 'downloading'
  | 'separating'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface SeparationProgressProps {
  phase: SeparationPhase;
  downloadProgress?: DownloadProgress | null;
  chunkProgress?: ChunkProgress | null;
  error?: string | null;
  onCancel: () => void;
  onRetry?: () => void;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const SeparationProgress: React.FC<SeparationProgressProps> = ({
  phase,
  downloadProgress,
  chunkProgress,
  error,
  onCancel,
  onRetry,
}) => {
  if (phase === 'idle' || phase === 'completed') {
    return null;
  }

  const isDownloading = phase === 'downloading';
  const isSeparating = phase === 'separating';
  const isError = phase === 'error';

  let percent = 0;
  if (isDownloading && downloadProgress) {
    percent = Math.round(downloadProgress.progress * 100);
  } else if (isSeparating && chunkProgress) {
    percent = Math.round(chunkProgress.progress * 100);
  }

  return (
    <div
      role="region"
      aria-label="Separation Progress"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-md transition-all animate-in fade-in duration-300"
    >
      {/* Header Info */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isDownloading && <Download className="h-5 w-5 animate-bounce" />}
            {isSeparating && <Cpu className="h-5 w-5 animate-pulse" />}
            {isError && <AlertTriangle className="h-5 w-5 text-destructive" />}
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isDownloading && 'Downloading Model Weights'}
              {isSeparating &&
                chunkProgress &&
                `Separating Chunk ${chunkProgress.chunkIndex + 1} of ${chunkProgress.totalChunks}`}
              {isSeparating && !chunkProgress && 'Initializing Neural Network Inference...'}
              {isError && 'Separation Error'}
            </h3>

            <p className="text-xs text-muted-foreground mt-0.5">
              {isDownloading && downloadProgress && (
                <>
                  Persisting HTDemucs v4 model into Model Cache (
                  {formatBytes(downloadProgress.loadedBytes)} / {formatBytes(downloadProgress.totalBytes)})
                </>
              )}
              {isDownloading && !downloadProgress && 'Connecting to Model Cache repository...'}
              {isSeparating &&
                chunkProgress &&
                `Elapsed: ${formatDuration(chunkProgress.elapsedMs)} • ETA: ${formatDuration(
                  chunkProgress.etaMs
                )}`}
              {isSeparating && !chunkProgress && 'Processing sequential Chunk Segments via WebGPU...'}
              {isError && error}
            </p>
          </div>
        </div>

        {/* Status Percentage badge or Cancel button */}
        <div className="flex items-center gap-3">
          {(isDownloading || isSeparating) && (
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {percent}%
            </span>
          )}

          {(isDownloading || isSeparating) && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              aria-label="Cancel separation"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Cancel</span>
            </button>
          )}

          {isError && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(isDownloading || isSeparating) && (
        <div className="mt-5 space-y-1.5">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {isDownloading
                ? 'Model Cache initialization'
                : 'Neural network chunk processing & overlap-add blending'}
            </span>
            <span>{percent}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
