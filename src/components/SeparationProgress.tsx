import React, { useState, useEffect } from "react";
import {
  Download,
  Cpu,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { DownloadProgress } from "../lib/modelCache";
import { ChunkProgress, ChunkStartEvent } from "../lib/inferenceClient";
import { ModelProfile, BS_ROFORMER_PROFILE } from "../lib/modelConfig";

export type SeparationPhase =
  "idle" | "downloading" | "separating" | "completed" | "cancelled" | "error";

export interface SeparationProgressProps {
  phase: SeparationPhase;
  downloadProgress?: DownloadProgress | null;
  chunkProgress?: ChunkProgress | null;
  chunkStart?: ChunkStartEvent | null;
  modelProfile?: ModelProfile;
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
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export const SeparationProgress: React.FC<SeparationProgressProps> = ({
  phase,
  downloadProgress,
  chunkProgress,
  chunkStart,
  modelProfile,
  error,
  onCancel,
  onRetry,
}) => {
  const activeProfile = modelProfile ?? BS_ROFORMER_PROFILE;
  const [activeSeconds, setActiveSeconds] = useState(0);

  useEffect(() => {
    if (phase !== "separating") {
      setActiveSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setActiveSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  if (phase === "idle" || phase === "completed") {
    return null;
  }

  const isDownloading = phase === "downloading";
  const isSeparating = phase === "separating";
  const isError = phase === "error";

  let percent = 0;
  if (isDownloading && downloadProgress) {
    percent = Math.round(downloadProgress.progress * 100);
  } else if (isSeparating && chunkProgress) {
    percent = Math.round(chunkProgress.progress * 100);
  }

  const currentChunkIndex = chunkProgress
    ? chunkProgress.chunkIndex + 1
    : chunkStart
      ? chunkStart.chunkIndex + 1
      : 1;

  const totalChunksCount = chunkProgress
    ? chunkProgress.totalChunks
    : chunkStart
      ? chunkStart.totalChunks
      : null;

  return (
    <div
      role="region"
      aria-label="Separation Progress"
      className="relative overflow-hidden rounded border border-border bg-card p-6 shadow-md transition-all animate-in fade-in duration-300"
    >
      {/* Header Info */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            {isDownloading && <Download className="h-5 w-5 animate-bounce" />}
            {isSeparating && <Cpu className="h-5 w-5 animate-pulse" />}
            {isError && <AlertTriangle className="h-5 w-5 text-destructive" />}
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              {isDownloading && `Downloading ${activeProfile.name} Weights`}
              {isSeparating &&
                totalChunksCount &&
                `Separating Chunk ${currentChunkIndex} of ${totalChunksCount}`}
              {isSeparating &&
                !totalChunksCount &&
                "Initializing Neural Network Inference..."}
              {isError && "Separation Error"}
              {isSeparating && (
                <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary font-normal">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeSeconds}s
                </span>
              )}
            </h3>

            <p className="text-xs text-muted-foreground mt-0.5">
              {isDownloading && downloadProgress && (
                <>
                  Persisting {activeProfile.name} into Model Cache (
                  {formatBytes(downloadProgress.loadedBytes)} /{" "}
                  {formatBytes(downloadProgress.totalBytes)})
                </>
              )}
              {isDownloading &&
                !downloadProgress &&
                "Connecting to Model Cache repository..."}
              {isSeparating &&
                chunkProgress &&
                `Elapsed: ${formatDuration(chunkProgress.elapsedMs)} • ETA: ${formatDuration(
                  chunkProgress.etaMs
                )}`}
              {isSeparating &&
                !chunkProgress &&
                (chunkStart?.stage === "wasm_inference"
                  ? "Executing multi-threaded CPU/WASM inference..."
                  : chunkStart?.stage === "webgpu_compiling"
                    ? "Compiling WebGPU shaders & executing inference... (first chunk takes longer)"
                    : chunkStart?.stage === "stft"
                      ? "Computing STFT frequency spectrogram..."
                      : chunkStart?.stage === "istft"
                        ? "Reconstructing audio stems via iSTFT..."
                        : "Processing sequential Chunk Segments...")}
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
              className="inline-flex items-center gap-1.5 rounded border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
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
              className="inline-flex items-center gap-1.5 rounded border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {/* Model Advisory Badge */}
      <div
        role="status"
        aria-label="Active Model Advisory"
        className="mt-4 flex items-center justify-between rounded border border-primary/20 bg-primary/5 px-3 py-2 text-xs"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">
            {activeProfile.shortName} ({activeProfile.name})
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            • {activeProfile.explanation}
          </span>
        </div>
        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
          {activeProfile.deviceCategory}
        </span>
      </div>

      {/* Progress Bar */}
      {(isDownloading || isSeparating) && (
        <div className="mt-5 space-y-1.5">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 w-full overflow-hidden rounded bg-secondary"
          >
            <div
              className="h-full bg-primary transition-all duration-300 ease-out rounded"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {isDownloading
                ? `${activeProfile.name} Model Cache initialization`
                : "Neural network chunk processing & overlap-add blending"}
            </span>
            <span>{percent}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
