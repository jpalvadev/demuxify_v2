import React from 'react';
import { Music2, Clock, Activity, Disc, Sparkles, X, RefreshCw } from 'lucide-react';
import { SourceMixMetadata } from '../lib/audioDecoder';
import { cn } from '../lib/utils';

export interface SourceMixCardProps {
  metadata: SourceMixMetadata;
  isProcessing?: boolean;
  onStartSeparation?: () => void;
  onRemove?: () => void;
  onChangeFile?: () => void;
  className?: string;
}

function formatDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatSampleRate(sampleRate: number): string {
  if (!sampleRate || isNaN(sampleRate)) return '44.1 kHz';
  return `${(sampleRate / 1000).toFixed(1)} kHz`;
}

function formatChannels(channels: number): string {
  if (channels === 1) return 'Mono';
  if (channels === 2) return 'Stereo';
  return `${channels} Channels`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const SourceMixCard: React.FC<SourceMixCardProps> = ({
  metadata,
  isProcessing = false,
  onStartSeparation,
  onRemove,
  onChangeFile,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card/90 p-5 shadow-sm backdrop-blur-sm transition-all sm:p-6',
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* File info */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Music2 className="h-6 w-6 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                Source Mix
              </span>
              <span className="text-xs text-muted-foreground">
                {formatBytes(metadata.fileSize)}
              </span>
            </div>
            <h3
              className="mt-0.5 truncate text-base font-semibold text-foreground sm:text-lg"
              title={metadata.fileName}
            >
              {metadata.fileName}
            </h3>
          </div>
        </div>

        {/* Change / Remove action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onChangeFile && (
            <button
              type="button"
              onClick={onChangeFile}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Change</span>
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={isProcessing}
              aria-label="Remove Source Mix"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary/50 p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata Badges Grid */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-xl bg-secondary/40 p-3 sm:gap-4 sm:p-4">
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-indigo-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Duration
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatDuration(metadata.duration)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Activity className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Sample Rate
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatSampleRate(metadata.sampleRate)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Disc className="h-4 w-4 text-purple-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Channels
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatChannels(metadata.numberOfChannels)}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      {onStartSeparation && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onStartSeparation}
            disabled={isProcessing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:from-indigo-600 hover:to-purple-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span>{isProcessing ? 'Separating Stems...' : 'Separate Stems'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
